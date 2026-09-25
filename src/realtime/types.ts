import type { DashboardEventName, DashboardEvents } from '../api/types';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

/**
 * What the screens listen to. Implemented by the fake source in src/mocks
 * and by the Socket.IO client for /dashboard-io (socketRealtime.ts).
 */
export interface RealtimeSource {
  /**
   * Open the connection. `getToken` is read on every (re)connect, so a
   * token refreshed in the meantime is picked up.
   */
  connect(getToken: () => string | null): void;
  disconnect(): void;
  /** Handlers stay registered across reconnects. Returns an unsubscribe function. */
  on<E extends DashboardEventName>(event: E, handler: (payload: DashboardEvents[E]) => void): () => void;
  /** Returns an unsubscribe function. */
  onState(handler: (state: ConnectionState) => void): () => void;
}
