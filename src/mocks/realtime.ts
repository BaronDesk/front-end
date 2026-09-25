/*
 * Fake /dashboard-io connection. Same interface as the Socket.IO client
 * (step 4), and the same room rules as back-end ops/dashboard.gateway.ts:
 * a user with a branch gets that branch's events, HQ gets every branch.
 * Gamers only get their own session_update.
 */
import type { DashboardEventName, DashboardEvents } from '../api/types';
import type { ConnectionState, RealtimeSource } from '../realtime/types';
import { subscribe } from './bus';
import type { MockUser } from './db';
import { userFromToken } from './handlers/auth';
import { startWorld } from './world';

const CONNECT_DELAY_MS = 300;

type AnyHandler = (payload: unknown) => void;

function allowed<E extends DashboardEventName>(user: MockUser, event: E, payload: DashboardEvents[E]): boolean {
  if (user.role === 'GAMER') {
    return event === 'session_update' && (payload as DashboardEvents['session_update']).userId === user.id;
  }
  if (!user.branchId) return true;
  return (payload as { branchId?: string }).branchId === user.branchId;
}

export interface FakeRealtime extends RealtimeSource {
  /** Drop the connection for `ms`, then reconnect, to test the reconnect banner. */
  simulateDrop(ms?: number): void;
}

export function createFakeRealtime(): FakeRealtime {
  const handlers = new Map<DashboardEventName, Set<AnyHandler>>();
  const stateHandlers = new Set<(s: ConnectionState) => void>();
  let getToken: (() => string | null) | null = null;
  let unsubscribeBus: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function setState(state: ConnectionState): void {
    for (const h of stateHandlers) h(state);
  }

  function open(): void {
    setState('connecting');
    timer = setTimeout(() => {
      const user = userFromToken(getToken?.() ?? null);
      if (!user) {
        console.warn('[mock realtime] connect refused: invalid token');
        setState('disconnected');
        return;
      }
      unsubscribeBus = subscribe((event, payload) => {
        if (!allowed(user, event, payload)) return;
        for (const h of handlers.get(event) ?? []) h(structuredClone(payload));
      });
      startWorld();
      setState('connected');
    }, CONNECT_DELAY_MS);
  }

  function close(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    unsubscribeBus?.();
    unsubscribeBus = null;
  }

  return {
    connect(tokenGetter) {
      close();
      getToken = tokenGetter;
      open();
    },
    disconnect() {
      close();
      getToken = null;
      setState('disconnected');
    },
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      const set = handlers.get(event)!;
      set.add(handler as AnyHandler);
      return () => set.delete(handler as AnyHandler);
    },
    onState(handler) {
      stateHandlers.add(handler);
      return () => stateHandlers.delete(handler);
    },
    simulateDrop(ms = 5000) {
      if (!getToken) return;
      close();
      setState('disconnected');
      timer = setTimeout(open, ms);
    },
  };
}
