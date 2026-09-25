import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

import { useAuth } from '../auth/AuthContext';
import { hasRole, ROLE_LABEL } from '../auth/roles';
import { MockBadge } from '../shared/MockBadge';
import { ADMIN_MENU } from './menu';
import { useBranchName } from './useBranchName';

function TopBar({ children }: { children?: ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <Link to="/" className="brand">
          BARONDESK<small>Venue administration</small>
        </Link>
        <MockBadge />
      </div>
      <div className="userbox">{children}</div>
    </div>
  );
}

function Footer() {
  return <div className="footer">BaronDesk &copy; 2026 &middot; v0.1</div>;
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const branchName = useBranchName(user);
  const menu = ADMIN_MENU.filter((item) => !item.minRole || hasRole(user, item.minRole));

  return (
    <>
      <TopBar>
        {/* Branch switcher for HQ: step 8. */}
        Branch: <b>{branchName}</b>
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

      <div className="layout">
        <nav className="sidemenu">
          <ul>
            {menu.map((item) => (
              <li key={item.path}>
                <NavLink to={item.path}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="content">
          <Outlet />
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
