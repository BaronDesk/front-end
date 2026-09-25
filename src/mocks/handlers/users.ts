/*
 * identity/ endpoints. The first four exist on the real backend too
 * (same bodies); the list, status and profile routes are brief §8 asks.
 */
import type { Role } from '../../api/types';
import { db, MOCK_PASSWORD, newId, nowIso, type MockUser } from '../db';
import {
  assertBranch,
  assertSelfOrStaff,
  badRequest,
  branchFilter,
  findUser,
  isHq,
  requireManager,
  requireStaff,
  requireUser,
} from '../guards';
import { publicUser } from '../logic';
import { MockHttpError, route } from '../router';

function assertUsernameFree(username: unknown): string {
  const name = String(username ?? '').trim();
  if (name.length < 3) badRequest('username must be at least 3 characters');
  if (db.users.some((u) => u.username === name)) {
    throw new MockHttpError(409, 'USERNAME_TAKEN', 'username is already taken');
  }
  return name;
}

function addUser(username: string, role: Role, branchId: string | null, password: string): MockUser {
  const user: MockUser = {
    id: newId(),
    username,
    role,
    accountStatus: 'ACTIVE',
    branchId,
    createdAt: nowIso(),
    password,
  };
  db.users.push(user);
  if (role === 'GAMER') {
    db.balances.set(user.id, 0);
    db.profiles.set(user.id, { userId: user.id, xp: 0, level: 1 });
  }
  return user;
}

// Gamer sign-up (public) or created at the desk by staff.
route('POST', '/users', ({ body }) => {
  const username = assertUsernameFree(body.username);
  return publicUser(addUser(username, 'GAMER', null, String(body.password ?? MOCK_PASSWORD)));
});

route('POST', '/employees', (ctx) => {
  const caller = requireManager(ctx);
  const { role, branchId } = ctx.body;
  if (role !== 'EMPLOYEE' && role !== 'MANAGER') badRequest('role must be EMPLOYEE or MANAGER');
  if (!db.branches.some((b) => b.id === branchId)) badRequest('unknown branchId');
  assertBranch(caller, branchId);
  if (role === 'MANAGER' && !isHq(caller)) {
    throw new MockHttpError(403, 'FORBIDDEN', 'only HQ can create branch managers');
  }
  const username = assertUsernameFree(ctx.body.username);
  return publicUser(addUser(username, role, branchId, String(ctx.body.password ?? MOCK_PASSWORD)));
});

route('PATCH', '/users/:id/role', (ctx) => {
  const caller = requireManager(ctx);
  const target = findUser(ctx.params.id);
  const role = ctx.body.role as Role;
  if (!['GAMER', 'EMPLOYEE', 'MANAGER', 'ADMIN'].includes(role)) badRequest('invalid role');
  if (!isHq(caller) && (role === 'MANAGER' || role === 'ADMIN' || target.role === 'MANAGER' || target.role === 'ADMIN')) {
    throw new MockHttpError(403, 'FORBIDDEN', 'only HQ can grant or change manager/admin roles');
  }
  const branchId = role === 'GAMER' || role === 'ADMIN' ? null : (ctx.body.branchId ?? target.branchId ?? caller.branchId);
  if (branchId) assertBranch(caller, branchId);
  target.role = role;
  target.branchId = branchId;
  return publicUser(target);
});

route('PATCH', '/users/:id/status', (ctx) => {
  const caller = requireManager(ctx);
  const target = findUser(ctx.params.id);
  if (target.branchId) assertBranch(caller, target.branchId);
  if (target.id === caller.id) badRequest('you cannot change your own status');
  const status = ctx.body.accountStatus;
  if (!['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].includes(status)) badRequest('invalid accountStatus');
  target.accountStatus = status;
  return publicUser(target);
});

route('GET', '/users/:id', (ctx) => {
  const caller = requireUser(ctx);
  assertSelfOrStaff(caller, ctx.params.id);
  return publicUser(findUser(ctx.params.id));
});

// ?role=GAMER&q=gam&branchId=… — gamers are global; staff are listed per branch.
route('GET', '/users', (ctx) => {
  const caller = requireStaff(ctx);
  const role = ctx.query.get('role');
  const q = (ctx.query.get('q') ?? '').toLowerCase();
  const branch = branchFilter(caller, ctx.query.get('branchId'));
  return db.users
    .filter((u) => !role || u.role === role)
    .filter((u) => !q || u.username.toLowerCase().includes(q))
    .filter((u) => u.role === 'GAMER' || !branch || u.branchId === branch || (u.role === 'ADMIN' && isHq(caller)))
    .map(publicUser);
});

route('GET', '/users/:id/profile', (ctx) => {
  const caller = requireUser(ctx);
  assertSelfOrStaff(caller, ctx.params.id);
  findUser(ctx.params.id);
  return db.profiles.get(ctx.params.id) ?? { userId: ctx.params.id, xp: 0, level: 1 };
});

route('GET', '/users/:id/membership', (ctx) => {
  const caller = requireUser(ctx);
  assertSelfOrStaff(caller, ctx.params.id);
  const now = Date.now();
  return db.memberships.find((m) => m.userId === ctx.params.id && Date.parse(m.endsAt) > now) ?? null;
});

route('GET', '/users/:id/subscriptions', (ctx) => {
  const caller = requireUser(ctx);
  assertSelfOrStaff(caller, ctx.params.id);
  return db.subscriptions.filter((s) => s.userId === ctx.params.id);
});
