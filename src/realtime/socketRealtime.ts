/*
 * Socket.IO client for /dashboard-io (back-end ops/dashboard.gateway.ts).
 * The server checks the access token once, at connect, and joins the
 * socket to its branch room (HQ: branch:all). Events are server → client only.
 */
import { io, type Socket } from 'socket.io-client';

import type { DashboardEventName } from '../api/types';
import { config } from '../config';
import type { ConnectionState, RealtimeSource } from './types';

type AnyHandler = (payload: unknown) => void;

/** Don't hammer /auth/refresh if the server keeps refusing the socket. */
const MIN_REFRESH_GAP_MS = 30_000;
const RETRY_AFTER_REFUSAL_MS = 10_000;

export function createSocketRealtime(refreshTokens: () => Promise<boolean>): RealtimeSource {
  const handlers = new Map<DashboardEventName, Set<AnyHandler>>();
  const stateHandlers = new Set<(s: ConnectionState) => void>();
  let socket: Socket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRefreshAt = 0;

  function setState(state: ConnectionState): void {
    for (const h of stateHandlers) h(state);
  }

  function close(): void {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    socket?.removeAllListeners();
    socket?.io.removeAllListeners();
    socket?.disconnect();
    socket = null;
  }

  return {
    connect(getToken) {
      close();
      const s = io(config.apiBase || undefined, {
        path: '/dashboard-io',
        // A function, so every reconnect sends the current (maybe refreshed) token.
        auth: (cb) => cb({ token: getToken() }),
        reconnectionDelayMax: 5_000,
      });
      socket = s;
      setState('connecting');

      s.on('connect', () => setState('connected'));
      s.on('disconnect', (reason) => {
        setState('disconnected');
        // The server closing us is the one case Socket.IO won't retry by itself.
        if (reason === 'io server disconnect') s.connect();
      });
      s.io.on('reconnect_attempt', () => setState('connecting'));

      s.on('connect_error', async (err) => {
        setState('disconnected');
        if (s.active) return; // network error: Socket.IO retries on its own
        console.warn('[realtime] /dashboard-io refused the connection:', err.message);
        // Refused by the server's auth middleware, most likely an expired
        // access token. Refresh it (at most every 30 s) and try again.
        if (Date.now() - lastRefreshAt > MIN_REFRESH_GAP_MS) {
          lastRefreshAt = Date.now();
          if ((await refreshTokens()) && socket === s) {
            setState('connecting');
            s.connect();
            return;
          }
        }
        retryTimer = setTimeout(() => {
          if (socket !== s) return;
          setState('connecting');
          s.connect();
        }, RETRY_AFTER_REFUSAL_MS);
      });

      s.onAny((event: string, payload: unknown) => {
        for (const h of handlers.get(event as DashboardEventName) ?? []) h(payload);
      });
    },

    disconnect() {
      close();
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
  };
}
