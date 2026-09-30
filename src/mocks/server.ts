/*
 * Entry point of the mock backend, called by api() in src/api/http.ts
 * for every mocked route. Seed accounts (password "password123"):
 *
 *   hq.admin        ADMIN     all branches
 *   manager.tunis   MANAGER   Tunis Centre      manager.sousse  MANAGER  Sousse
 *   staff.tunis     EMPLOYEE  Tunis Centre      staff.sousse    EMPLOYEE Sousse
 *   gamer1…gamer5   GAMER     (gamer1 has Gold −10 %, gamer3 has a 10-hour pass)
 *   lowbalance      GAMER     0.400 balance, runs out after ~8 min of play
 */
import type { HttpMethod } from '../api/http';
import './handlers/auth';
import './handlers/users';
import './handlers/stations';
import './handlers/games';
import './handlers/ops';
import './handlers/money';
import './handlers/bookings';
import { userFromToken } from './handlers/auth';
import { dispatch, type MockResponse } from './router';
import { startWorld } from './world';

/** Enough to see "pending" states in the UI, short enough not to annoy. */
const MIN_LATENCY_MS = 120;
const MAX_LATENCY_MS = 250;

export async function handleMockRequest(
  method: HttpMethod,
  path: string,
  body: unknown,
  token: string | null,
): Promise<MockResponse> {
  startWorld();
  await new Promise((r) => setTimeout(r, MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS)));
  const res = await dispatch(method, path, body, userFromToken(token));
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') console.debug(`[mock] ${method} ${path} → ${res.status}`);
  return res;
}
