import { Link, Outlet, useLocation } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { PageErrorBoundary } from '../shared/PageErrorBoundary';

export function PortalLayout() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="portal">
      <div className="topbar">
        <div>
          <Link to="/" className="brand">
            BARONDESK
          </Link>
        </div>
        {user && (
          <div className="userbox">
            <b>{user.username}</b>
            <span className="sep">|</span>
            <a
              href="#/login"
              onClick={(e) => {
                e.preventDefault();
                void logout();
              }}
            >
              Logout
            </a>
          </div>
        )}
      </div>
      <main className="content">
        {pathname !== '/' && pathname !== '/login' && pathname !== '/signup' && (
          <p>
            <Link to="/">« Menu</Link>
          </p>
        )}
        <PageErrorBoundary>
          <Outlet />
        </PageErrorBoundary>
      </main>
      <div className="footer">BaronDesk &copy; 2026</div>
    </div>
  );
}
