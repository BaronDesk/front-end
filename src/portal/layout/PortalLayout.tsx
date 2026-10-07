import { Link, Outlet, useLocation } from 'react-router';

import { useAuth } from '../../auth/AuthContext';
import { PageErrorBoundary } from '../../shared/components/PageErrorBoundary';
import { LogoutLink, TopBar } from '../../shared/components/TopBar';

export function PortalLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <div className="portal">
      {user ? (
        <TopBar>
          <b>{user.username}</b>
          <span className="sep">|</span>
          <LogoutLink />
        </TopBar>
      ) : (
        <TopBar />
      )}
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
