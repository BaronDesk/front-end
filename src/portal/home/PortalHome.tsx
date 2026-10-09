import { Link } from 'react-router';

import type { Reservation, Wallet } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { formatCoins } from '../../shared/lib/format';
import { currentBooking, stationOf } from '../../shared/lib/bookings';
import { PORTAL_MENU } from '../menu';

/** The portal's start page: balance, what needs attention now, and the menu. */
export function PortalHome() {
  const { user } = useAuth();
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const bookings = useApiQuery<Reservation[]>('/reservations');
  const now = currentBooking(bookings.data);

  return (
    <>
      <h1>Welcome, {user?.username}</h1>
      <div className="big-figure">
        Balance
        <b className={wallet.data && wallet.data.balance <= 0 ? 'status-bad' : ''}>{wallet.data ? formatCoins(wallet.data.balance) : '…'}</b>
      </div>
      {user && !user.homeBranchId && (
        <div className="msg msg-error">
          Pick the branch you play at to see its stations: <Link to="/settings">Settings »</Link>
        </div>
      )}
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
