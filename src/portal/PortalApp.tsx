import type { ReactNode } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router';

import type { SessionView, Wallet } from '../api/types';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { RequireAuth } from '../auth/guards';
import { RealtimeProvider, useRealtimeEvent } from '../realtime/RealtimeContext';
import { formatMoney } from '../shared/format';
import { LoginForm } from '../shared/LoginForm';
import { useApiQuery } from '../shared/useApiQuery';
import { PORTAL_MENU } from './menu';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { BookPage } from './pages/BookPage';
import { ProfilePage } from './pages/ProfilePage';
import { SessionPage } from './pages/SessionPage';
import { WalletPage } from './pages/WalletPage';
import { PortalLayout } from './PortalLayout';

const PAGES: Record<string, ReactNode> = {
  '/availability': <AvailabilityPage />,
  '/book': <BookPage />,
  '/wallet': <WalletPage />,
  '/session': <SessionPage />,
  '/profile': <ProfilePage />,
};

function PortalHome() {
  const { user } = useAuth();
  const wallet = useApiQuery<Wallet>(user ? `/wallet/${user.id}` : null);
  const session = useApiQuery<SessionView | null>('/me/session');
  useRealtimeEvent('session_update', (e) => {
    if (e.userId !== user?.id) return;
    session.reload();
    if (e.status === 'ENDED') wallet.reload();
  });

  const s = session.data;
  return (
    <>
      <h1>Welcome, {user?.username}</h1>
      <div className="big-figure">
        Balance
        <b className={wallet.data && wallet.data.balance <= 0 ? 'status-bad' : ''}>{wallet.data ? formatMoney(wallet.data.balance) : '…'}</b>
      </div>
      {s && (
        <div className={s.status === 'WARNED' ? 'msg msg-error' : 'msg msg-ok'}>
          {s.status === 'WARNED' ? <b>Low balance: your session ends soon.</b> : 'You are playing now.'}{' '}
          <Link to="/session">My session »</Link>
        </div>
      )}
      <ul className="portal-menu">
        {PORTAL_MENU.map((item) => (
          <li key={item.path}>
            <Link to={item.path}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function PortalNotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        <Link to="/">« Back to the menu</Link>
      </p>
    </>
  );
}

export function PortalApp() {
  return (
    <AuthProvider app="portal">
      {/* Only the gamer's own session_update is used; see SessionPage. */}
      <RealtimeProvider>
        <HashRouter>
          <Routes>
            <Route element={<PortalLayout />}>
              <Route
                path="/login"
                element={
                  <>
                    <h1>Login</h1>
                    <LoginForm legend="Gamer login" mockHint="Try gamer1 / password123, or lowbalance for the warning." />
                  </>
                }
              />
              <Route element={<RequireAuth />}>
                <Route index element={<PortalHome />} />
                {PORTAL_MENU.map((item) => (
                  <Route key={item.path} path={item.path} element={PAGES[item.path]} />
                ))}
                <Route path="*" element={<PortalNotFound />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
