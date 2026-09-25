import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import type { Role } from '../api/types';
import { useAuth } from './AuthContext';
import { hasRole } from './roles';

/** Children render only when logged in; otherwise go to /login and come back after. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <p className="content muted">Loading…</p>;
  if (state.status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/**
 * Hides a page from roles below `min`. This is UX only: the server's 403
 * is the real rule (brief §12, rule 1).
 */
export function RequireRole({ min, children }: { min: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasRole(user, min)) return <Navigate to="/denied" replace />;
  return <>{children}</>;
}
