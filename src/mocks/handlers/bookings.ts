/*
 * session/ endpoints: reservations and sessions.
 */
import type { Reservation, Session, SessionView } from '../../api/types';
import { db, newId, nowIso } from '../db';
import {
  assertBranch,
  assertSelfOrStaff,
  badRequest,
  branchFilter,
  findStation,
  isStaff,
  notFound,
  requireStaff,
  requireUser,
} from '../guards';
import { endSession, postTransaction, publishStation, sessionUpdate, startSession, overlaps } from '../logic';
import { MockHttpError, route, type MockContext } from '../router';

const MAX_BOOKING_HOURS = 6;
/** Cancelling at least this long before the start refunds the booking fee. */
const FREE_CANCEL_MS = 60 * 60_000;

function view(session: Session): SessionView {
  const live = sessionUpdate(session);
  return {
    ...session,
    elapsedSeconds: live.elapsedSeconds,
    estimatedCost: live.estimatedCost,
    balance: live.balance,
    runoutAt: live.runoutAt,
  };
}

function findSession(id: string): Session {
  return db.sessions.find((s) => s.id === id) ?? notFound('session');
}

function findReservation(id: string): Reservation {
  return db.reservations.find((r) => r.id === id) ?? notFound('reservation');
}

/** Local calendar day of an ISO date, as YYYY-MM-DD. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- reservations ----------

route('GET', '/reservations', (ctx) => {
  const caller = requireStaff(ctx);
  const branch = branchFilter(caller, ctx.query.get('branchId'));
  const machineId = ctx.query.get('machineId');
  const date = ctx.query.get('date');
  const status = ctx.query.get('status');
  return db.reservations
    .filter(
      (r) =>
        (!branch || r.branchId === branch) &&
        (!machineId || r.machineId === machineId) &&
        (!date || localDay(r.start) === date) &&
        (!status || r.status === status),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
});

route('GET', '/me/reservations', (ctx) => {
  const caller = requireUser(ctx);
  return db.reservations
    .filter((r) => r.userId === caller.id)
    .sort((a, b) => b.start.localeCompare(a.start));
});

route('POST', '/reservations', (ctx) => {
  const caller = requireUser(ctx);
  const userId = String(ctx.body.userId ?? caller.id);
  assertSelfOrStaff(caller, userId);
  const s = findStation(String(ctx.body.machineId ?? ''));
  if (isStaff(caller)) assertBranch(caller, s.branchId);
  if (s.enrollmentStatus !== 'APPROVED') badRequest('station is not available for booking');

  const start = Date.parse(ctx.body.start);
  const end = Date.parse(ctx.body.end);
  if (Number.isNaN(start) || Number.isNaN(end)) badRequest('start and end must be ISO dates');
  if (end <= start) badRequest('end must be after start');
  if (start < Date.now() - 5 * 60_000) badRequest('start is in the past');
  if (end - start > MAX_BOOKING_HOURS * 3_600_000) badRequest(`a booking is at most ${MAX_BOOKING_HOURS} hours`);

  const startIso = new Date(start).toISOString();
  const endIso = new Date(end).toISOString();
  if (overlaps(s.id, startIso, endIso)) {
    throw new MockHttpError(409, 'RESERVATION_CONFLICT', 'this station is already booked for that time');
  }

  if (db.pricing.bookingFee > 0) {
    postTransaction(userId, 'BOOKING_FEE', -db.pricing.bookingFee, { note: `Booking ${s.name}` });
  }
  const r: Reservation = {
    id: newId(),
    userId,
    machineId: s.id,
    branchId: s.branchId,
    start: startIso,
    end: endIso,
    status: 'BOOKED',
    createdAt: nowIso(),
  };
  db.reservations.push(r);
  return r;
});

route('POST', '/reservations/:id/checkin', (ctx) => {
  const caller = requireStaff(ctx);
  const r = findReservation(ctx.params.id);
  assertBranch(caller, r.branchId);
  if (r.status !== 'BOOKED') throw new MockHttpError(409, 'INVALID_RESERVATION_STATE', `reservation is ${r.status}`);
  const session = startSession(r.userId, r.machineId);
  r.status = 'CHECKED_IN';
  return view(session);
});

route('DELETE', '/reservations/:id', (ctx) => {
  const caller = requireUser(ctx);
  const r = findReservation(ctx.params.id);
  assertSelfOrStaff(caller, r.userId);
  if (isStaff(caller)) assertBranch(caller, r.branchId);
  if (r.status !== 'BOOKED') throw new MockHttpError(409, 'INVALID_RESERVATION_STATE', `reservation is ${r.status}`);
  r.status = 'CANCELLED';
  if (db.pricing.bookingFee > 0 && Date.parse(r.start) - Date.now() >= FREE_CANCEL_MS) {
    postTransaction(r.userId, 'REFUND', db.pricing.bookingFee, { note: 'Booking fee refund' });
  }
  return undefined;
});

// ---------- sessions ----------

// ?status=ACTIVE returns every running session (ACTIVE and WARNED).
route('GET', '/sessions', (ctx) => {
  const caller = requireStaff(ctx);
  const branch = branchFilter(caller, ctx.query.get('branchId'));
  const status = ctx.query.get('status');
  return db.sessions
    .filter((s) => (!branch || s.branchId === branch) && (!status || (status === 'ACTIVE' ? s.status !== 'ENDED' : s.status === status)))
    .map(view);
});

route('GET', '/me/session', (ctx) => {
  const caller = requireUser(ctx);
  const s = db.sessions.find((x) => x.userId === caller.id && x.status !== 'ENDED');
  return s ? view(s) : null;
});

route('GET', '/sessions/:id', (ctx) => {
  const caller = requireUser(ctx);
  const s = findSession(ctx.params.id);
  assertSelfOrStaff(caller, s.userId);
  if (isStaff(caller)) assertBranch(caller, s.branchId);
  return view(s);
});

route('POST', '/sessions', (ctx) => {
  const caller = requireStaff(ctx);
  const station = findStation(String(ctx.body.machineId ?? ''));
  assertBranch(caller, station.branchId);
  const user = db.users.find((u) => u.id === ctx.body.userId) ?? notFound('user');
  if (user.role !== 'GAMER') badRequest('sessions are for gamers', 'NOT_A_GAMER');
  return view(startSession(user.id, station.id));
});

route('POST', '/sessions/:id/end', (ctx) => {
  const caller = requireUser(ctx);
  const s = findSession(ctx.params.id);
  assertSelfOrStaff(caller, s.userId);
  if (isStaff(caller)) assertBranch(caller, s.branchId);
  const reason = String(ctx.body.reason ?? (isStaff(caller) ? 'STAFF_ENDED' : 'USER_ENDED'));
  return view(endSession(s, reason));
});

function setLock(locked: boolean) {
  return (ctx: MockContext) => {
    const caller = requireStaff(ctx);
    const s = findSession(ctx.params.id);
    assertBranch(caller, s.branchId);
    if (s.status === 'ENDED') throw new MockHttpError(409, 'SESSION_ENDED', 'session already ended');
    const station = findStation(s.machineId);
    station.locked = locked;
    if (locked) station.runningGameId = null;
    publishStation(station);
    return view(s);
  };
}

route('POST', '/sessions/:id/lock', setLock(true));
route('POST', '/sessions/:id/unlock', setLock(false));
