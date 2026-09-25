/*
 * station/ endpoints: branches, stations, enrollment, telemetry snapshot,
 * availability, games and station games.
 */
import type { BranchSummary, Game, StationAvailability } from '../../api/types';
import { db, newId, nowIso } from '../db';
import {
  assertBranch,
  badRequest,
  branchFilter,
  findStation,
  notFound,
  requireHq,
  requireManager,
  requireStaff,
  requireUser,
} from '../guards';
import { publishStation } from '../logic';
import { MockHttpError, route, type MockContext } from '../router';

// ---------- branches ----------

route('GET', '/branches', (ctx) => {
  const caller = requireStaff(ctx);
  return db.branches.filter((b) => !caller.branchId || b.id === caller.branchId);
});

route('GET', '/branches/summary', (ctx) => {
  requireHq(ctx);
  return db.branches.map<BranchSummary>((b) => {
    const st = db.stations.filter((s) => s.branchId === b.id && s.enrollmentStatus === 'APPROVED');
    return {
      branchId: b.id,
      name: b.name,
      stationsTotal: st.length,
      stationsOnline: st.filter((s) => s.online).length,
      stationsInSession: st.filter((s) => s.sessionId).length,
      openAlerts: db.alerts.filter((a) => a.branchId === b.id && a.status !== 'RESOLVED').length,
    };
  });
});

// ---------- stations ----------

// Only approved stations; the enrollment queue has its own endpoint.
route('GET', '/stations', (ctx) => {
  const caller = requireStaff(ctx);
  const branch = branchFilter(caller, ctx.query.get('branchId'));
  return db.stations.filter((s) => s.enrollmentStatus === 'APPROVED' && (!branch || s.branchId === branch));
});

// Public-ish list for the gamer portal: no MAC/IP, just free or busy.
route('GET', '/stations/availability', (ctx) => {
  requireUser(ctx);
  const branch = ctx.query.get('branchId');
  const soon = Date.now() + 30 * 60_000;
  return db.stations
    .filter((s) => s.enrollmentStatus === 'APPROVED' && (!branch || s.branchId === branch))
    .map<StationAvailability>((s) => {
      const next = db.reservations
        .filter((r) => r.machineId === s.id && r.status === 'BOOKED' && Date.parse(r.end) > Date.now())
        .sort((a, b) => a.start.localeCompare(b.start))[0];
      return {
        machineId: s.id,
        branchId: s.branchId,
        name: s.name,
        free: s.online && !s.sessionId && !(next && Date.parse(next.start) < soon),
        nextReservationAt: next?.start ?? null,
      };
    });
});

route('GET', '/stations/:id', (ctx) => {
  const caller = requireStaff(ctx);
  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  return s;
});

// Latest telemetry from the cache, so the detail page isn't empty until the next push.
route('GET', '/stations/:id/telemetry', (ctx) => {
  const caller = requireStaff(ctx);
  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  return s.online ? (db.telemetry.get(s.id) ?? []) : [];
});

// ---------- enrollment ----------

route('GET', '/enrollment', (ctx) => {
  const caller = requireManager(ctx);
  const status = ctx.query.get('status');
  const branch = branchFilter(caller, ctx.query.get('branchId'));
  return db.stations.filter(
    (s) => (!status || s.enrollmentStatus === status) && (!branch || s.branchId === branch),
  );
});

function enrollmentAction(to: 'APPROVED' | 'REJECTED' | 'REVOKED', from: string[]) {
  return (ctx: MockContext) => {
    const caller = requireManager(ctx);
    const s = findStation(ctx.params.machineId);
    assertBranch(caller, s.branchId);
    if (!from.includes(s.enrollmentStatus)) {
      throw new MockHttpError(409, 'INVALID_ENROLLMENT_STATE', `station is ${s.enrollmentStatus}`);
    }
    s.enrollmentStatus = to;
    if (to !== 'APPROVED') {
      s.online = false;
      s.sessionId = null;
    }
    publishStation(s);
    return to === 'APPROVED' ? { credentialIssued: true } : undefined;
  };
}

route('POST', '/enrollment/:machineId/approve', enrollmentAction('APPROVED', ['PENDING']));
route('POST', '/enrollment/:machineId/reject', enrollmentAction('REJECTED', ['PENDING']));
route('POST', '/enrollment/:machineId/revoke', enrollmentAction('REVOKED', ['APPROVED']));

// ---------- games ----------

function findGame(id: string): Game {
  return db.games.find((g) => g.id === id) ?? notFound('game');
}

function readGame(body: Record<string, unknown>, base?: Game): Omit<Game, 'id'> {
  const title = String(body.title ?? base?.title ?? '').trim();
  const executablePath = String(body.executablePath ?? base?.executablePath ?? '').trim();
  if (!title) badRequest('title is required');
  if (!executablePath) badRequest('executablePath is required');
  return {
    title,
    executablePath,
    genre: String(body.genre ?? base?.genre ?? ''),
    cover: (body.cover as string | null | undefined) ?? base?.cover ?? null,
  };
}

route('GET', '/games', (ctx) => {
  requireStaff(ctx);
  return db.games;
});

route('POST', '/games', (ctx) => {
  requireManager(ctx);
  const game: Game = { id: newId(), ...readGame(ctx.body) };
  db.games.push(game);
  return game;
});

route('PATCH', '/games/:id', (ctx) => {
  requireManager(ctx);
  const game = findGame(ctx.params.id);
  Object.assign(game, readGame(ctx.body, game));
  return game;
});

route('DELETE', '/games/:id', (ctx) => {
  requireManager(ctx);
  findGame(ctx.params.id);
  db.games.splice(db.games.findIndex((g) => g.id === ctx.params.id), 1);
  for (const [machineId, ids] of db.stationGames) {
    db.stationGames.set(machineId, ids.filter((id) => id !== ctx.params.id));
  }
  return undefined;
});

route('GET', '/stations/:id/games', (ctx) => {
  const caller = requireStaff(ctx);
  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  const ids = db.stationGames.get(s.id) ?? [];
  return db.games.filter((g) => ids.includes(g.id));
});

route('POST', '/stations/:id/games', (ctx) => {
  const caller = requireManager(ctx);
  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  const game = findGame(ctx.body.gameId);
  const ids = db.stationGames.get(s.id) ?? [];
  if (ids.includes(game.id)) throw new MockHttpError(409, 'ALREADY_ASSIGNED', 'game is already on this station');
  db.stationGames.set(s.id, [...ids, game.id]);
  return { machineId: s.id, gameId: game.id, assignedAt: nowIso() };
});

route('DELETE', '/stations/:id/games/:gameId', (ctx) => {
  const caller = requireManager(ctx);
  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  db.stationGames.set(s.id, (db.stationGames.get(s.id) ?? []).filter((id) => id !== ctx.params.gameId));
  return undefined;
});
