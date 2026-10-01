import type { PublicUser } from '../../api/types';

/*
 * Which account buttons the Users page shows. They mirror the server's rules
 * (identity/services/users.service.ts); the server's 403 is still the real
 * check. HQ = ADMIN; below HQ the caller is a branch admin (MANAGER).
 */

/** The branch an account belongs to: a staff member's branch, a gamer's home branch. */
export function accountBranchId(u: PublicUser): string | null {
  return u.role === 'GAMER' ? u.homeBranchId : u.branchId;
}

/** Below HQ, nobody changes their own role or that of a branch admin or HQ (FORBIDDEN_ROLE_ESCALATION). */
export function canChangeRole(caller: PublicUser, target: PublicUser): boolean {
  if (target.id === caller.id) return false;
  if (caller.role === 'ADMIN') return true;
  return target.role !== 'MANAGER' && target.role !== 'ADMIN';
}

/** Suspend / reactivate: HQ anyone but themselves; a branch admin only their branch's staff. */
export function canSetStatus(caller: PublicUser, target: PublicUser): boolean {
  if (target.id === caller.id) return false;
  if (caller.role === 'ADMIN') return true;
  return target.role === 'EMPLOYEE' && target.branchId !== null && target.branchId === caller.branchId;
}

/** Password reset: HQ anyone but themselves; a branch admin their branch's staff and gamers (own: Settings). */
export function canResetPassword(caller: PublicUser, target: PublicUser): boolean {
  if (target.id === caller.id) return false;
  if (caller.role === 'ADMIN') return true;
  if (caller.branchId === null) return false;
  if (target.role === 'EMPLOYEE') return target.branchId === caller.branchId;
  if (target.role === 'GAMER') return target.homeBranchId === caller.branchId;
  return false;
}
