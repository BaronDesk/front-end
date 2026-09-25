import type { PublicUser, Role } from '../api/types';

/** Backend role → brief role (Frontend Implementation Plan §1). */
export const ROLE_LABEL: Record<Role, string> = {
  GAMER: 'Gamer',
  EMPLOYEE: 'Staff',
  MANAGER: 'Branch admin',
  ADMIN: 'HQ',
};

const RANK: Record<Role, number> = { GAMER: 0, EMPLOYEE: 1, MANAGER: 2, ADMIN: 3 };

/** True when the user's role is `min` or higher. The server still decides. */
export function hasRole(user: PublicUser | null, min: Role): boolean {
  return user !== null && RANK[user.role] >= RANK[min];
}
