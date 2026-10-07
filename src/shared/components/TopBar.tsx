import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../../auth/AuthContext';

/** The black bar on top of both apps: the brand (with the app's name) and, on the right, the user box. */
export function TopBar({ subtitle, children }: { subtitle?: string; children?: ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <Link to="/" className="brand">
          BARONDESK
          {subtitle && <small>{subtitle}</small>}
        </Link>
      </div>
      {children !== undefined && <div className="userbox">{children}</div>}
    </div>
  );
}

/** "Logout" in the user box: ends the session on the server, then the app shows its login. */
export function LogoutLink() {
  const { logout } = useAuth();
  return (
    <a
      href="#/login"
      onClick={(e) => {
        e.preventDefault();
        void logout();
      }}
    >
      Logout
    </a>
  );
}
