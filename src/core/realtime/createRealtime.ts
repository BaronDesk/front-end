import { refreshTokens } from '../auth/tokens';
import { createSocketRealtime } from './socketRealtime';
import type { RealtimeSource } from './types';

/** The Socket.IO client for the backend's /dashboard-io. */
export async function createRealtime(): Promise<RealtimeSource> {
  return createSocketRealtime(refreshTokens);
}
