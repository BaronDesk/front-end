import { describe, expect, it } from 'vitest';

import type { PublicUser, Role } from '../../api/types';
import { accountBranchId, canChangeRole, canResetPassword, canSetStatus } from './permissions';

const user = (id: string, role: Role, branchId: string | null, homeBranchId: string | null = null): PublicUser => ({
  id,
  username: id,
  role,
  accountStatus: 'ACTIVE',
  branchId,
  gamerProfileId: role === 'GAMER' ? `gp-${id}` : null,
  homeBranchId,
  createdAt: '2026-10-01T00:00:00Z',
});

const hq = user('hq', 'ADMIN', null);
const manager = user('mgr', 'MANAGER', 'b1');
const ownStaff = user('emp1', 'EMPLOYEE', 'b1');
const otherStaff = user('emp2', 'EMPLOYEE', 'b2');
const otherManager = user('mgr2', 'MANAGER', 'b1');
const ownGamer = user('g1', 'GAMER', null, 'b1');
const otherGamer = user('g2', 'GAMER', null, 'b2');

describe('Users page permissions', () => {
  it('uses the home branch for gamers and the branch for staff', () => {
    expect(accountBranchId(ownGamer)).toBe('b1');
    expect(accountBranchId(otherStaff)).toBe('b2');
    expect(accountBranchId(hq)).toBeNull();
  });

  it('HQ may change anyone but themselves', () => {
    for (const target of [manager, ownStaff, otherGamer]) {
      expect(canChangeRole(hq, target)).toBe(true);
      expect(canSetStatus(hq, target)).toBe(true);
      expect(canResetPassword(hq, target)).toBe(true);
    }
    expect(canChangeRole(hq, hq)).toBe(false);
    expect(canSetStatus(hq, hq)).toBe(false);
    expect(canResetPassword(hq, hq)).toBe(false);
  });

  it('a branch admin never changes a branch admin, HQ or themselves', () => {
    for (const target of [manager, otherManager, hq]) {
      expect(canChangeRole(manager, target)).toBe(false);
      expect(canSetStatus(manager, target)).toBe(false);
      expect(canResetPassword(manager, target)).toBe(false);
    }
  });

  it('a branch admin suspends only their own staff', () => {
    expect(canSetStatus(manager, ownStaff)).toBe(true);
    expect(canSetStatus(manager, otherStaff)).toBe(false);
    expect(canSetStatus(manager, ownGamer)).toBe(false);
  });

  it("a branch admin resets their staff's and their gamers' passwords", () => {
    expect(canResetPassword(manager, ownStaff)).toBe(true);
    expect(canResetPassword(manager, ownGamer)).toBe(true);
    expect(canResetPassword(manager, otherStaff)).toBe(false);
    expect(canResetPassword(manager, otherGamer)).toBe(false);
  });
});
