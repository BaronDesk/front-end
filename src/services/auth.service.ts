import { api } from '../core/http/client';
import type { LoginResponse, PublicUser } from '../core/api-types';

/** Accounts and login (identity module): the only code that knows these routes. */
export const authService = {
  login: (username: string, password: string) => api<LoginResponse>('POST', '/auth/login', { username, password }),
  me: () => api<PublicUser>('GET', '/auth/me'),
  logout: (refreshToken: string) => api('POST', '/auth/logout', { refreshToken }),
  /** The server ends every other login and answers a new token pair. */
  changePassword: (passwords: { currentPassword: string; newPassword: string }) => api<LoginResponse>('POST', '/auth/change-password', passwords),
  /** Sign-up: every gamer picks the branch they play at. */
  signUp: (account: { username: string; password: string; branchId: string }) => api<PublicUser>('POST', '/users', account),
};
