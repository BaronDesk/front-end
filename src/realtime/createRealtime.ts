import { refreshTokens } from '../auth/tokens';
import { isMocked } from '../config';
import type { RealtimeSource } from './types';

declare global {
  interface Window {
    /** Dev helpers, only with fake data: barondesk.simulateDrop(ms) tests the reconnect banner. */
    barondesk?: { simulateDrop(ms?: number): void };
  }
}

/** Fake source when /dashboard-io is mocked, the real Socket.IO client otherwise. */
export async function createRealtime(): Promise<RealtimeSource> {
  if (isMocked('/dashboard-io')) {
    const { createFakeRealtime } = await import('../mocks/realtime');
    const fake = createFakeRealtime();
    if (import.meta.env.DEV) window.barondesk = { simulateDrop: (ms) => fake.simulateDrop(ms) };
    return fake;
  }
  const { createSocketRealtime } = await import('./socketRealtime');
  return createSocketRealtime(refreshTokens);
}
