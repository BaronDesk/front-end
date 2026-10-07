/** Accounts and login (identity module). */

export type Role = 'GAMER' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'DELETED';

/** identity/util/public-user.ts */
export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  accountStatus: AccountStatus;
  /** The branch a staff member works at. null = HQ / global scope, or a gamer. */
  branchId: string | null;
  /** A gamer's profile id (wallet, bookings); null for staff. */
  gamerProfileId: string | null;
  /** The branch a gamer plays at: the booking page lists its stations. */
  homeBranchId: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}
