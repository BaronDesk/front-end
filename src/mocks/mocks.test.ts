/*
 * The mock backend must behave like the real one on the rules the demo
 * relies on: auth, branch scope, command loop, double-booking, idempotency,
 * billing and auto-lock. Tests share one in-memory db, so each uses its own
 * stations and users.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  BranchSummary,
  CommandLog,
  DashboardEvents,
  Reservation,
  SessionView,
  Station,
  TelemetrySnapshot,
  WalletTransaction,
} from '../api/types';
import { db } from './db';
import { userFromToken } from './handlers/auth';
import { createFakeRealtime } from './realtime';
import { handleMockRequest } from './server';
import { tickSessions } from './world';

const byName = (name: string) => db.stations.find((s) => s.name === name)!;
const userId = (username: string) => db.users.find((u) => u.username === username)!.id;

async function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, token: string | null = null) {
  const pending = handleMockRequest(method, path, body, token);
  await vi.advanceTimersByTimeAsync(300); // mock latency
  return pending;
}

async function login(username: string): Promise<string> {
  const res = await call('POST', '/auth/login', { username, password: 'password123' });
  expect(res.status).toBe(200);
  return (res.data as { accessToken: string }).accessToken;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('auth', () => {
  it('logs in, then /auth/me returns the public user without the password', async () => {
    const token = await login('staff.tunis');
    const me = await call('GET', '/auth/me', undefined, token);
    expect(me.status).toBe(200);
    expect(me.data).toMatchObject({ username: 'staff.tunis', role: 'EMPLOYEE', branchId: db.branches[0].id });
    expect(me.data).not.toHaveProperty('password');
  });

  it('rejects a wrong password with the backend error shape', async () => {
    const res = await call('POST', '/auth/login', { username: 'staff.tunis', password: 'nope' });
    expect(res).toEqual({ status: 401, data: { error: 'invalid username or password', code: 'INVALID_CREDENTIALS' } });
  });

  it('rotates refresh tokens: each one works once', async () => {
    const res = await call('POST', '/auth/login', { username: 'gamer1', password: 'password123' });
    const { refreshToken } = res.data as { refreshToken: string };
    expect((await call('POST', '/auth/refresh', { refreshToken })).status).toBe(200);
    expect((await call('POST', '/auth/refresh', { refreshToken })).status).toBe(401);
  });

  it('accepts a real backend JWT by its claims', () => {
    const claims = { sub: 'aaaaaaaa-0000-4000-8000-000000000001', role: 'EMPLOYEE', branchId: 'unknown-branch' };
    const jwt = `x.${btoa(JSON.stringify(claims))}.sig`;
    const user = userFromToken(jwt);
    expect(user).toMatchObject({ id: claims.sub, role: 'EMPLOYEE', branchId: db.branches[0].id });
  });
});

describe('branch scope and roles', () => {
  it('staff see only their branch; HQ sees all', async () => {
    const staff = await call('GET', '/api/v1/stations', undefined, await login('staff.sousse'));
    const hq = await call('GET', '/api/v1/stations', undefined, await login('hq.admin'));
    const staffStations = staff.data as Station[];
    expect(staffStations.every((s) => s.branchId === db.branches[1].id)).toBe(true);
    expect((hq.data as Station[]).length).toBeGreaterThan(staffStations.length);
  });

  it('403 FORBIDDEN_BRANCH on another branch station', async () => {
    const res = await call('GET', `/api/v1/stations/${byName('TUN-01').id}`, undefined, await login('staff.sousse'));
    expect(res.status).toBe(403);
    expect(res.data).toMatchObject({ code: 'FORBIDDEN_BRANCH' });
  });

  it('403 FORBIDDEN for an employee on a manager page', async () => {
    const res = await call('GET', '/enrollment?status=PENDING', undefined, await login('staff.tunis'));
    expect(res.status).toBe(403);
    expect(res.data).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('401 without a token', async () => {
    expect((await call('GET', '/api/v1/stations')).status).toBe(401);
  });

  it('404 for a route that has no mock', async () => {
    expect((await call('GET', '/nope', undefined, await login('hq.admin'))).status).toBe(404);
  });
});

describe('telemetry', () => {
  it('serves the latest snapshot of an online station; 404 TELEMETRY_NOT_AVAILABLE when offline', async () => {
    const token = await login('staff.tunis');
    const online = byName('TUN-01');
    await vi.advanceTimersByTimeAsync(2_100); // one telemetry tick

    const res = await call('GET', `/api/v1/stations/${online.id}/telemetry`, undefined, token);
    expect(res.status).toBe(200);
    const snapshot = res.data as TelemetrySnapshot;
    expect(snapshot).toMatchObject({ machineId: online.id, serialNumber: online.serialNumber, branchId: online.branchId });
    expect(snapshot.metrics['cpu.temperature_c']).toEqual(expect.any(Number));

    const offline = await call('GET', `/api/v1/stations/${byName('TUN-04').id}/telemetry`, undefined, token);
    expect(offline).toMatchObject({ status: 404, data: { code: 'TELEMETRY_NOT_AVAILABLE' } });
  });
});

describe('HQ (multi-agency)', () => {
  it('?branchId narrows HQ lists to one branch; staff cannot widen theirs', async () => {
    const sousse = db.branches[1].id;
    const hq = await call('GET', `/api/v1/stations?branchId=${sousse}`, undefined, await login('hq.admin'));
    expect((hq.data as Station[]).length).toBeGreaterThan(0);
    expect((hq.data as Station[]).every((s) => s.branchId === sousse)).toBe(true);

    const staff = await call('GET', `/api/v1/stations?branchId=${sousse}`, undefined, await login('staff.tunis'));
    expect((staff.data as Station[]).every((s) => s.branchId === db.branches[0].id)).toBe(true);
  });

  it('branch summary is HQ only and counts approved stations per branch', async () => {
    expect((await call('GET', '/branches/summary', undefined, await login('manager.tunis'))).status).toBe(403);

    const res = await call('GET', '/branches/summary', undefined, await login('hq.admin'));
    expect(res.status).toBe(200);
    const rows = res.data as BranchSummary[];
    expect(rows.map((r) => r.name).sort()).toEqual(db.branches.map((b) => b.name).sort());
    const tunis = rows.find((r) => r.branchId === db.branches[0].id)!;
    const approved = db.stations.filter((s) => s.branchId === db.branches[0].id && s.enrollmentStatus === 'APPROVED');
    expect(tunis.stationsTotal).toBe(approved.length);
    expect(tunis.stationsOnline).toBe(approved.filter((s) => s.online).length);
  });

  it('HQ locks a station in another branch; a manager from another branch cannot', async () => {
    const station = byName('SOU-01');
    station.locked = false;
    const denied = await call('POST', '/commands', { machineId: station.id, type: 'LOCK', payload: {} }, await login('manager.tunis'));
    expect(denied.status).toBe(403);
    expect(denied.data).toMatchObject({ code: 'FORBIDDEN_BRANCH' });

    const res = await call('POST', '/commands', { machineId: station.id, type: 'LOCK', payload: {} }, await login('hq.admin'));
    expect(res.status).toBe(200);
    await vi.advanceTimersByTimeAsync(600);
    expect(station.locked).toBe(true);
  });
});

describe('commands and realtime', () => {
  it('LOCK: PENDING, then command_result ACKED + station_status, only to the right branch', async () => {
    const tunisToken = await login('staff.tunis');
    const tunis = createFakeRealtime();
    const sousse = createFakeRealtime();
    const tunisResults: DashboardEvents['command_result'][] = [];
    const tunisStatus: DashboardEvents['station_status'][] = [];
    const sousseResults: unknown[] = [];
    tunis.on('command_result', (e) => tunisResults.push(e));
    tunis.on('station_status', (e) => tunisStatus.push(e));
    sousse.on('command_result', (e) => sousseResults.push(e));
    tunis.connect(() => tunisToken);
    const sousseToken = await login('staff.sousse');
    sousse.connect(() => sousseToken);
    await vi.advanceTimersByTimeAsync(400);

    const station = byName('TUN-05');
    station.locked = false;
    const res = await call('POST', '/commands', { machineId: station.id, type: 'LOCK', payload: {} }, tunisToken);
    expect((res.data as CommandLog).status).toBe('PENDING');

    await vi.advanceTimersByTimeAsync(600);
    expect(tunisResults).toContainEqual(expect.objectContaining({ commandId: (res.data as CommandLog).id, status: 'ACKED' }));
    expect(tunisStatus).toContainEqual(expect.objectContaining({ serialNumber: station.serialNumber, locked: true }));
    expect(sousseResults).toHaveLength(0);
    tunis.disconnect();
    sousse.disconnect();
  });

  it('command to an offline station times out', async () => {
    const token = await login('manager.tunis');
    const station = byName('TUN-04'); // seeded offline
    const res = await call('POST', '/commands', { machineId: station.id, type: 'UNLOCK', payload: {} }, token);
    await vi.advanceTimersByTimeAsync(5_100);
    const log = await call('GET', `/commands?machineId=${station.id}`, undefined, token);
    const cmd = (log.data as CommandLog[]).find((c) => c.id === (res.data as CommandLog).id)!;
    expect(cmd).toMatchObject({ status: 'TIMEOUT', reason: 'no response from station' });
  });

  it('LAUNCH_GAME of a game not on the station is NACKED', async () => {
    const token = await login('manager.tunis');
    const station = byName('TUN-03');
    station.locked = false;
    const notInstalled = db.games.find((g) => !(db.stationGames.get(station.id) ?? []).includes(g.id))!;
    const res = await call('POST', '/commands', { machineId: station.id, type: 'LAUNCH_GAME', payload: { gameId: notInstalled.id } }, token);
    await vi.advanceTimersByTimeAsync(600);
    const log = await call('GET', `/commands?machineId=${station.id}`, undefined, token);
    expect((log.data as CommandLog[]).find((c) => c.id === (res.data as CommandLog).id)).toMatchObject({
      status: 'NACKED',
      code: 'EXEC_FAILED',
    });
  });

  it('gamers only receive their own session_update', async () => {
    const rt = createFakeRealtime();
    const got: DashboardEvents['session_update'][] = [];
    const other: unknown[] = [];
    rt.on('session_update', (e) => got.push(e));
    rt.on('station_status', (e) => other.push(e));
    const gamerToken = await login('gamer2');
    rt.connect(() => gamerToken);
    await vi.advanceTimersByTimeAsync(400);
    tickSessions();
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((e) => e.userId === userId('gamer2'))).toBe(true);
    expect(other).toHaveLength(0);
    rt.disconnect();
  });
});

describe('money and bookings', () => {
  it('rejects a double booking with 409 RESERVATION_CONFLICT', async () => {
    const token = await login('staff.tunis');
    const station = byName('TUN-01');
    const start = new Date(Date.now() + 2 * 3_600_000);
    const end = new Date(start.getTime() + 3_600_000);
    const body = { userId: userId('gamer4'), machineId: station.id, start: start.toISOString(), end: end.toISOString() };
    const first = await call('POST', '/reservations', body, token);
    expect(first.status).toBe(200);
    expect((first.data as Reservation).status).toBe('BOOKED');
    const second = await call('POST', '/reservations', { ...body, userId: userId('gamer5') }, token);
    expect(second.status).toBe(409);
    expect(second.data).toMatchObject({ code: 'RESERVATION_CONFLICT' });
  });

  it('top-up with the same idempotencyKey credits once', async () => {
    const token = await login('staff.tunis');
    const id = userId('gamer5');
    const before = db.balances.get(id)!;
    const body = { amount: 10, method: 'CASH', idempotencyKey: 'key-1' };
    const a = await call('POST', `/wallet/${id}/topup`, body, token);
    const b = await call('POST', `/wallet/${id}/topup`, body, token);
    expect((a.data as WalletTransaction).id).toBe((b.data as WalletTransaction).id);
    expect(db.balances.get(id)).toBe(before + 10);
  });

  it('ending a session bills with the membership discount and locks the station', async () => {
    const token = await login('staff.tunis');
    const station = byName('TUN-05');
    const start = await call('POST', '/sessions', { userId: userId('gamer1'), machineId: station.id }, token);
    expect(start.status).toBe(200);
    expect(byName('TUN-05').locked).toBe(false);

    await vi.advanceTimersByTimeAsync(60 * 60_000); // 1 hour
    const end = await call('POST', `/sessions/${(start.data as SessionView).id}/end`, {}, token);
    const billing = (end.data as SessionView).billing!;
    expect(billing).toMatchObject({ ratePerHour: 3, discountPercent: 10 });
    expect(billing.minutes).toBeGreaterThanOrEqual(60);
    expect(billing.total).toBeCloseTo(billing.subtotal * 0.9, 3);
    expect(byName('TUN-05')).toMatchObject({ locked: true, sessionId: null });
  });

  it('auto-ends and locks when the balance runs out', async () => {
    const token = await login('staff.sousse');
    const station = byName('SOU-02');
    const start = await call('POST', '/sessions', { userId: userId('lowbalance'), machineId: station.id }, token);
    expect(start.status).toBe(200);

    tickSessions();
    expect(db.sessions.find((s) => s.id === (start.data as SessionView).id)!.status).toBe('WARNED');

    vi.setSystemTime(Date.now() + 10 * 60_000); // 0.4 at 3/h lasts 8 min
    tickSessions();
    const session = db.sessions.find((s) => s.id === (start.data as SessionView).id)!;
    expect(session).toMatchObject({ status: 'ENDED', endReason: 'BALANCE_EXHAUSTED' });
    expect(db.balances.get(userId('lowbalance'))).toBe(0);
    expect(byName('SOU-02')).toMatchObject({ locked: true, sessionId: null });
  });
});

describe('gamer portal', () => {
  it('a gamer sees every venue and station availability, without MAC or IP', async () => {
    const token = await login('gamer4');
    const branches = await call('GET', '/branches', undefined, token);
    expect(branches.data).toHaveLength(db.branches.length);
    const av = await call('GET', `/stations/availability?branchId=${db.branches[1].id}`, undefined, token);
    const rows = av.data as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.branchId === db.branches[1].id && !('mac' in r) && !('ip' in r))).toBe(true);
  });

  it('books for themselves only, pays the fee, and gets it back on an early cancel', async () => {
    const token = await login('gamer4');
    const me = userId('gamer4');
    const start = new Date(Date.now() + 26 * 3_600_000);
    const end = new Date(start.getTime() + 2 * 3_600_000);
    const body = { machineId: byName('TUN-03').id, start: start.toISOString(), end: end.toISOString() };

    const forOther = await call('POST', '/reservations', { ...body, userId: userId('gamer5') }, token);
    expect(forOther.status).toBe(403);

    const before = db.balances.get(me)!;
    const booked = await call('POST', '/reservations', { ...body, userId: me }, token);
    expect(booked.status).toBe(200);
    expect(db.balances.get(me)).toBe(before - db.pricing.bookingFee);
    const mine = await call('GET', '/me/reservations', undefined, token);
    expect((mine.data as Reservation[]).map((r) => r.id)).toContain((booked.data as Reservation).id);

    expect((await call('DELETE', `/reservations/${(booked.data as Reservation).id}`, undefined, token)).status).toBe(204);
    expect(db.balances.get(me)).toBe(before);
  });

  it('self top-up is ONLINE; another gamer’s wallet is off limits', async () => {
    const token = await login('gamer5');
    const res = await call('POST', `/wallet/${userId('gamer5')}/topup`, { amount: 5, method: 'CASH', idempotencyKey: 'self-1' }, token);
    expect(res.data).toMatchObject({ type: 'TOPUP', amount: 5, method: 'ONLINE' });
    expect((await call('GET', `/wallet/${userId('gamer4')}`, undefined, token)).status).toBe(403);
  });

  it('a gamer reads and ends their own session and gets the bill', async () => {
    const staff = await login('staff.sousse');
    const started = await call('POST', '/sessions', { userId: userId('gamer5'), machineId: byName('SOU-01').id }, staff);
    expect(started.status).toBe(200);

    const token = await login('gamer5');
    const mine = await call('GET', '/me/session', undefined, token);
    expect(mine.data).toMatchObject({ id: (started.data as SessionView).id });
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    const ended = await call('POST', `/sessions/${(started.data as SessionView).id}/end`, {}, token);
    expect(ended.data).toMatchObject({ status: 'ENDED', endReason: 'USER_ENDED' });
    expect((ended.data as SessionView).billing!.total).toBeGreaterThan(0);
    expect((await call('GET', '/me/session', undefined, token)).data).toBeNull();
  });
});
