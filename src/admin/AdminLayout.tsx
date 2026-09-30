import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { hasRole, ROLE_LABEL } from '../auth/roles';
import { ConnectionBanner, LiveTag } from '../shared/ConnectionBanner';
import { PageErrorBoundary } from '../shared/PageErrorBoundary';
import { AlertBanner } from './alerts/AlertBanner';
import { AlertFeedProvider, useAlertFeed } from './alerts/AlertFeedContext';
import { BranchProvider, BranchSwitcher, useBranchScope } from './branch/BranchContext';
import { ADMIN_MENU } from './menu';

function TopBar({ children }: { children?: ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <Link to="/" className="brand">
          BARONDESK<small>Venue administration</small>
        </Link>
      </div>
      <div className="userbox">{children}</div>
    </div>
  );
}

function Footer() {
  return <div className="footer">BaronDesk &copy; 2026 &middot; v0.1</div>;
}

export function AdminLayout() {
  return (
    <BranchProvider>
      <AlertFeedProvider>
        <AdminShell />
      </AlertFeedProvider>
    </BranchProvider>
  );
}

function AdminShell() {
  const { user, logout } = useAuth();
  const { openCount } = useAlertFeed();
  const { branchId } = useBranchScope();
  const menu = ADMIN_MENU.filter((item) => !item.minRole || hasRole(user, item.minRole));

  return (
    <>
      <TopBar>
        <LiveTag />
        <span className="sep">|</span>
        <BranchSwitcher />
        <span className="sep">|</span>
        <b>{user?.username}</b> ({user && ROLE_LABEL[user.role]})
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
      </TopBar>
      <ConnectionBanner />
      <AlertBanner />

      <div className="layout">
        <nav className="sidemenu">
          <ul>
            {menu.map((item) => (
              <li key={item.path}>
                <NavLink to={item.path}>
                  {item.label}
                  {item.path === '/alerts' && openCount > 0 && <span className="menu-count"> ({openCount})</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="content">
          {/* A new branch starts every page fresh: lists, forms and selections. */}
          <PageErrorBoundary>
            <Outlet key={branchId ?? 'all'} />
          </PageErrorBoundary>
        </main>
      </div>

      <Footer />
    </>
  );
}

/** Login screen: top bar and a small centered box, no menu. */
export function AdminLoginLayout() {
  return (
    <>
      <TopBar />
      <div className="login-box">
        <Outlet />
      </div>
      <Footer />
    </>
  );
}
