/*
 * Server-side event bus of the mock backend. Handlers and timers publish
 * here; every fake /dashboard-io connection (realtime.ts) filters what it
 * forwards by the connected user's branch, like the real gateway's rooms.
 */
import type { DashboardEventName, DashboardEvents } from '../api/types';

type Listener = <E extends DashboardEventName>(event: E, payload: DashboardEvents[E]) => void;

const listeners = new Set<Listener>();

export function publish<E extends DashboardEventName>(event: E, payload: DashboardEvents[E]): void {
  for (const listener of listeners) listener(event, payload);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
