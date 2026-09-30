import type { ReactNode } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router';

import type { Reservation, Wallet } from '../api/types';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { RequireAuth } from '../auth/guards';
import { RealtimeProvider } from '../realtime/RealtimeContext';
import { formatMillimes } from '../shared/format';
import { LoginForm } from '../shared/LoginForm';
import { useApiQuery } from '../shared/useApiQuery';
import { currentBooking, stationOf } from './bookings';
import { PORTAL_MENU } from './menu';
import { BookPage } from './pages/BookPage';
import { ProfilePage } from './pages/ProfilePage';
import { SessionPage } from './pages/SessionPage';
import { WalletPage } from './pages/WalletPage';
import { PortalLayout } from './PortalLayout';

const PAGES: Record<string, ReactNode> = {
  '/book': <BookPage />,
  '/session': <SessionPage />,
  '/wallet': <WalletPage />,
  '/profile': <ProfilePage />,
};

function PortalHome() {
  const { user } = useAuth();
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const bookings = useApiQuery<Reservation[]>('/reservations');
  const now = currentBooking(bookings.data);

  return (
    <>
      <h1>Welcome, {user?.username}</h1>
      <div className="big-figure">
        Balance
        <b className={wallet.data && wallet.data.balance <= 0 ? 'status-bad' : ''}>{wallet.data ? formatMillimes(wallet.data.balance) : '…'}</b>
      </div>
      {now && (
        <div className="msg msg-ok">
          {now.status === 'ACTIVE' ? `You are playing on ${stationOf(now)}.` : `Your booking on ${stationOf(now)} is now.`}{' '}
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
      {/* Only session_runout_warning is used, on My session. */}
      <RealtimeProvider>
        <HashRouter>
          <Routes>
            <Route element={<PortalLayout />}>
              <Route
                path="/login"
                element={
                  <>
                    <h1>Login</h1>
                    <LoginForm legend="Gamer login" />
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
