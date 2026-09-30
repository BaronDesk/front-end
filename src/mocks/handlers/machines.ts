/*
 * machines/ endpoints, like back-end machines.controller.ts and
 * enrollment.controller.ts: the enrollment queue (list, approve, reject,
 * revoke) and one-time enrollment tokens. A PC asks to join with a token
 * (agent: --set-enrollment-token); it shows up here as PENDING and can only
 * connect once approved. No live event announces a request: the page polls.
 */
import type { EnrollmentToken, MachineEnrollmentStatus } from '../../api/types';
import { db } from '../db';
import { assertBranch, badRequest, branchFilter, requireManager, requireStaff } from '../guards';
import { publishStation, setOnline, toMachine } from '../logic';
import { MockHttpError, route, type MockContext } from '../router';

const STATUSES: MachineEnrollmentStatus[] = ['PENDING', 'ENROLLED', 'INACTIVE', 'DEACTIVATED'];
const DEFAULT_TTL_MINUTES = 30;
const MAX_TTL_MINUTES = 24 * 60;
/** After approval the fake agent's next enrollment poll gets its credential, then it connects. */
const CONNECT_AFTER_APPROVAL_MS = 2_000;

function findMachine(id: string) {
  const s = db.stations.find((x) => x.id === id);
  if (!s) throw new MockHttpError(404, 'MACHINE_NOT_FOUND', 'machine not found');
  return s;
}

function newToken(ttlMinutes: number): EnrollmentToken {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { token, expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString() };
}

// Staff see their branch; HQ everything, or one branch with ?branchId.
route('GET', '/machines', (ctx) => {
  const caller = requireStaff(ctx);
  const requested = ctx.query.get('branchId');
  if (requested) assertBranch(caller, requested);
  const branch = branchFilter(caller, requested);
  const status = ctx.query.get('status');
  if (status && !STATUSES.includes(status as MachineEnrollmentStatus)) badRequest('invalid status');
  return db.stations
    .filter((s) => (!branch || s.branchId === branch) && (!status || s.enrollmentStatus === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toMachine);
});

route('GET', '/machines/:id', (ctx) => {
  const caller = requireStaff(ctx);
  const s = findMachine(ctx.params.id);
  assertBranch(caller, s.branchId);
  return toMachine(s);
});

function decide(to: 'ENROLLED' | 'DEACTIVATED', onlyFromPending: boolean) {
  return (ctx: MockContext) => {
    const caller = requireManager(ctx);
    const s = findMachine(ctx.params.id);
    assertBranch(caller, s.branchId);
    if (onlyFromPending && s.enrollmentStatus !== 'PENDING') {
      throw new MockHttpError(409, 'MACHINE_NOT_PENDING', 'machine enrollment is not pending');
    }
    s.enrollmentStatus = to;
    if (to === 'ENROLLED') {
      setTimeout(() => s.enrollmentStatus === 'ENROLLED' && !s.online && setOnline(s, true), CONNECT_AFTER_APPROVAL_MS);
    } else if (s.online) {
      // A deactivated station is no longer admitted: it drops off.
      s.sessionId = null;
      s.online = false;
      s.lastSeenAt = new Date().toISOString();
      publishStation(s);
    }
    return toMachine(s);
  };
}

route('POST', '/machines/:id/approve', decide('ENROLLED', true));
route('POST', '/machines/:id/reject', decide('DEACTIVATED', true));
route('POST', '/machines/:id/revoke', decide('DEACTIVATED', false));

route('POST', '/machines/enrollment-tokens', (ctx) => {
  const caller = requireManager(ctx);
  const branchId = typeof ctx.body.branchId === 'string' ? ctx.body.branchId : '';
  if (!db.branches.some((b) => b.id === branchId)) badRequest('branchId must be a branch id');
  assertBranch(caller, branchId);
  const ttl = ctx.body.ttlMinutes === undefined ? DEFAULT_TTL_MINUTES : Number(ctx.body.ttlMinutes);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_TTL_MINUTES) badRequest(`ttlMinutes must be 1 to ${MAX_TTL_MINUTES}`);
  return newToken(ttl);
});

// A fresh token bound to an enrolled machine, e.g. after its disk was wiped.
route('POST', '/machines/:id/rotate-token', (ctx) => {
  const caller = requireManager(ctx);
  const s = findMachine(ctx.params.id);
  assertBranch(caller, s.branchId);
  if (s.enrollmentStatus !== 'ENROLLED') {
    throw new MockHttpError(409, 'MACHINE_NOT_ENROLLED', 'only an enrolled machine can rotate its credential');
  }
  return newToken(DEFAULT_TTL_MINUTES);
});
