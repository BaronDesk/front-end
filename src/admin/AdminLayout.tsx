import { Link, NavLink, Outlet } from 'react-router';

import { ADMIN_MENU } from './menu';

export function AdminLayout() {
  return (
    <>
      <div className="topbar">
        <Link to="/" className="brand">
          BARONDESK<small>Venue administration</small>
        </Link>
        <div className="userbox">
          {/* Branch switcher: step 8. Logged-in user: step 3. */}
          Branch: <b>—</b>
          <span className="sep">|</span>
          Not logged in
          <span className="sep">|</span>
          <Link to="/login">Login</Link>
        </div>
      </div>

      <div className="layout">
        <nav className="sidemenu">
          <ul>
            {ADMIN_MENU.map((item) => (
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

      <div className="footer">BaronDesk &copy; 2026 &middot; v0.1</div>
    </>
  );
}
