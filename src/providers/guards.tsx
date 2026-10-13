import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import type { Role } from '../core/api-types';
import { useAuth } from './AuthProvider';
import { hasRole } from '../core/auth/roles';

/**
 * Children render only when logged in; otherwise go to `loginPath` (the
 * portal: its welcome screen) and come back after.
 */
export function RequireAuth({ loginPath = '/login' }: { loginPath?: string }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <p className="content muted">Loading…</p>;
  if (state.status === 'anonymous') return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/**
 * Hides a page from roles below `min`. This is UX only: the server's 403
 * is the real rule.
 */
export function RequireRole({ min, children }: { min: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasRole(user, min)) return <Navigate to="/denied" replace />;
  return <>{children}</>;
}
