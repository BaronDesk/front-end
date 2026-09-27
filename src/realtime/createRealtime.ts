import { refreshTokens } from '../auth/tokens';
import { isMocked } from '../config';
import type { RealtimeSource } from './types';

declare global {
  interface Window {
    /**
     * Dev helpers, only with fake data: barondesk.simulateDrop(ms) tests the
     * reconnect banner, barondesk.simulateAlert() raises an alert now,
     * barondesk.startSession(username) starts a gamer's session (portal).
     */
    barondesk?: { simulateDrop(ms?: number): void; simulateAlert(): void; startSession(username: string): string };
  }
}

/** Fake source when /dashboard-io is mocked, the real Socket.IO client otherwise. */
export async function createRealtime(): Promise<RealtimeSource> {
  if (isMocked('/dashboard-io')) {
    const [{ createFakeRealtime }, { randomAlert, startDemoSession }] = await Promise.all([import('../mocks/realtime'), import('../mocks/world')]);
    const fake = createFakeRealtime();
    if (import.meta.env.DEV) window.barondesk = { simulateDrop: (ms) => fake.simulateDrop(ms), simulateAlert: randomAlert, startSession: startDemoSession };
    return fake;
  }
  const { createSocketRealtime } = await import('./socketRealtime');
  return createSocketRealtime(refreshTokens);
}
