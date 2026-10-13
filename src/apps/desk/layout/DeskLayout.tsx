import { Link, NavLink, Outlet } from 'react-router';

import { useAuth } from '../../../providers/AuthProvider';
import { hasRole, ROLE_LABEL } from '../../../core/auth/roles';
import { ConnectionBanner, LiveTag } from '../components/ConnectionBanner';
import { PageErrorBoundary } from '../../../components/layout/PageErrorBoundary';
import { LogoutLink, TopBar } from '../components/TopBar';
import { AlertBanner } from '../components/AlertBanner';
import { AlertFeedProvider, useAlertFeed } from '../providers/AlertFeedContext';
import { BranchProvider, BranchSwitcher, useBranchScope } from '../providers/BranchContext';
import { DESK_MENU } from '../menu';

const SUBTITLE = 'Venue administration';

function Footer() {
  return <div className="footer">BaronDesk &copy; 2026 &middot; v0.1</div>;
}

export function DeskLayout() {
  return (
    <BranchProvider>
      <AlertFeedProvider>
        <AdminShell />
      </AlertFeedProvider>
    </BranchProvider>
  );
}

function AdminShell() {
  const { user } = useAuth();
  const { openCount } = useAlertFeed();
  const { branchId } = useBranchScope();
  const menu = DESK_MENU.filter((item) => !item.minRole || hasRole(user, item.minRole));

  return (
    <>
      <TopBar subtitle={SUBTITLE}>
        <LiveTag />
        <span className="sep">|</span>
        <BranchSwitcher />
        <span className="sep">|</span>
        <b>{user?.username}</b> ({user && ROLE_LABEL[user.role]})
        <span className="sep">|</span>
        <Link to="/account">Password</Link>
        <span className="sep">|</span>
        <LogoutLink />
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
export function DeskLoginLayout() {
  return (
    <>
      <TopBar subtitle={SUBTITLE} />
      <div className="login-box">
        <Outlet />
      </div>
      <Footer />
    </>
  );
}
