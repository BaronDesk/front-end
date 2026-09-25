import type { DashboardEventName, DashboardEvents } from '../api/types';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

/**
 * What the screens listen to. Implemented by the fake source in src/mocks
 * (step 2) and by the Socket.IO client for /dashboard-io (step 4).
 */
export interface RealtimeSource {
  connect(accessToken: string): void;
  disconnect(): void;
  /** Returns an unsubscribe function. */
  on<E extends DashboardEventName>(event: E, handler: (payload: DashboardEvents[E]) => void): () => void;
  /** Returns an unsubscribe function. */
  onState(handler: (state: ConnectionState) => void): () => void;
}
