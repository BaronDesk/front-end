/*
 * station/ endpoints: branches, stations, enrollment, telemetry snapshot and
 * availability. Games and a station's games are in games.ts.
 */
import type { BranchSummary, StationAvailability } from '../../api/types';
import { db } from '../db';
import {
  assertBranch,
  branchFilter,
  findStation,
  requireHq,
  requireManager,
  requireStaff,
  requireUser,
} from '../guards';
import { publishStation, toStationDetail, toStationDto } from '../logic';
import { MockHttpError, route, type MockContext } from '../router';

// ---------- branches ----------

// Gamers (branchId null) see every branch too: the portal books in either venue.
route('GET', '/branches', (ctx) => {
  const caller = requireUser(ctx);
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
      openAlerts: db.alerts.filter((a) => a.branchId === b.id && !a.acknowledged).length,
    };
  });
});

// ---------- stations ----------

// Only approved stations; the enrollment queue has its own endpoint.
// The real list ignores ?branchId= today; the mock honours it (HQ view).
route('GET', '/api/v1/stations', (ctx) => {
  const caller = requireStaff(ctx);
  const branch = branchFilter(caller, ctx.query.get('branchId'));
  return db.stations
    .filter((s) => s.enrollmentStatus === 'APPROVED' && (!branch || s.branchId === branch))
    .map(toStationDto);
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

route('GET', '/api/v1/stations/:id', (ctx) => {
  const caller = requireStaff(ctx);
  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  return toStationDetail(s);
});

// Latest telemetry from the cache, so the detail page isn't empty until the next push.
// The real server answers 404 once its 30 s cache entry expired; offline here.
route('GET', '/api/v1/stations/:id/telemetry', (ctx) => {
  const caller = requireStaff(ctx);
  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  const snapshot = s.online ? db.telemetry.get(s.id) : undefined;
  if (!snapshot) throw new MockHttpError(404, 'TELEMETRY_NOT_AVAILABLE', 'no live telemetry for this station');
  return snapshot;
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
