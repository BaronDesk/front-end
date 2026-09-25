/*
 * Role and branch checks for mock handlers, mirroring ADR-002 scopes:
 * self · staff(branch) · admin(branch) · hq(global).
 */
import type { Role } from '../api/types';
import { db, type MockUser } from './db';
import { MockHttpError, type MockContext } from './router';

const RANK: Record<Role, number> = { GAMER: 0, EMPLOYEE: 1, MANAGER: 2, ADMIN: 3 };

export function requireUser(ctx: MockContext): MockUser {
  if (!ctx.user) throw new MockHttpError(401, 'UNAUTHORIZED', 'missing or invalid access token');
  if (ctx.user.accountStatus !== 'ACTIVE') throw new MockHttpError(403, 'ACCOUNT_INACTIVE', 'account is not active');
  return ctx.user;
}

function requireRank(ctx: MockContext, min: Role): MockUser {
  const user = requireUser(ctx);
  if (RANK[user.role] < RANK[min]) {
    throw new MockHttpError(403, 'FORBIDDEN', `requires role ${min} or higher`);
  }
  return user;
}

/** EMPLOYEE, MANAGER or ADMIN. */
export const requireStaff = (ctx: MockContext) => requireRank(ctx, 'EMPLOYEE');
/** MANAGER or ADMIN. */
export const requireManager = (ctx: MockContext) => requireRank(ctx, 'MANAGER');
/** ADMIN (HQ) only. */
export const requireHq = (ctx: MockContext) => requireRank(ctx, 'ADMIN');

export function isStaff(user: MockUser): boolean {
  return RANK[user.role] >= RANK.EMPLOYEE;
}

export function isHq(user: MockUser): boolean {
  return user.role === 'ADMIN';
}

/** Staff may only act inside their own branch; HQ anywhere. */
export function assertBranch(user: MockUser, branchId: string): void {
  if (isHq(user)) return;
  if (user.branchId !== branchId) {
    throw new MockHttpError(403, 'FORBIDDEN_BRANCH', 'this resource belongs to another branch');
  }
}

/** Which branch a list is limited to: own branch for staff, ?branchId (or all) for HQ. */
export function branchFilter(user: MockUser, requested: string | null): string | null {
  if (isHq(user)) return requested || null;
  return user.branchId;
}

/** Gamers may only touch their own records. */
export function assertSelfOrStaff(user: MockUser, userId: string): void {
  if (user.id !== userId && !isStaff(user)) {
    throw new MockHttpError(403, 'FORBIDDEN', 'you can only access your own records');
  }
}

export function notFound(what: string): never {
  throw new MockHttpError(404, 'NOT_FOUND', `${what} not found`);
}

export function badRequest(message: string, code = 'VALIDATION_ERROR'): never {
  throw new MockHttpError(400, code, message);
}

export function findStation(id: string) {
  return db.stations.find((s) => s.id === id) ?? notFound('station');
}

export function findUser(id: string) {
  return db.users.find((u) => u.id === id) ?? notFound('user');
}
