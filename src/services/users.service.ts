import { api } from '../core/http/client';
import type { PublicUser, Role } from '../core/api-types';

/** Accounts: the signed-in user's own, and (desk) the branch's gamers and staff. */
export const usersService = {
  paths: {
    list: (params: URLSearchParams) => `/users?${params}`,
  },
  /** A gamer changes the branch they play at (their booking page follows it). */
  setHomeBranch: (branchId: string) => api<PublicUser>('PATCH', '/users/me/branch', { branchId }),

  // Desk
  /** Gamers whose username contains `q` (the wallet's search). */
  searchGamers: (q: string) => api<PublicUser[]>('GET', `/gamers?q=${encodeURIComponent(q)}`),
  createGamer: (body: { username: string; password: string; branchId: string }) => api<PublicUser>('POST', '/users', body),
  createEmployee: (body: { username: string; password: string; role: Role; branchId: string }) => api<PublicUser>('POST', '/employees', body),
  setRole: (id: string, role: Role, branchId: string | null) => api<PublicUser>('PATCH', `/users/${id}/role`, { role, branchId }),
  setSuspended: (id: string, suspended: boolean) => api<PublicUser>('PATCH', `/users/${id}/status`, { status: suspended ? 'SUSPENDED' : 'ACTIVE' }),
  /** Logs the user out everywhere: they must use the new password. */
  resetPassword: (id: string, newPassword: string) => api('POST', `/users/${id}/password`, { newPassword }),
};
