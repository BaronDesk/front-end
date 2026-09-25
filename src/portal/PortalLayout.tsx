import { Link, Outlet, useLocation } from 'react-router';

export function PortalLayout() {
  const { pathname } = useLocation();

  return (
    <div className="portal">
      <div className="topbar">
        <Link to="/" className="brand">
          BARONDESK
        </Link>
        <div className="userbox">
          {/* Logged-in gamer: step 3. */}
          <Link to="/login">Login</Link>
        </div>
      </div>
      <main className="content">
        {pathname !== '/' && (
          <p>
            <Link to="/">« Menu</Link>
          </p>
        )}
        <Outlet />
      </main>
      <div className="footer">BaronDesk &copy; 2026</div>
    </div>
  );
}
