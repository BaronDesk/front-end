import { Link } from 'react-router';

import type { Wallet } from '../../api/types';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { groupThousands } from '../../shared/lib/format';
import coin from './assets/coin.png';

/** The gamer's coins in the Bookings header: a dark pill ending under the Baron coin ("30.000"). It opens My wallet. */
export function CoinBalance() {
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const balance = wallet.data?.balance;
  return (
    <Link to="/wallet" className="bd-coins" aria-label={balance === undefined ? 'My wallet' : `My wallet: ${balance} coins`}>
      <span className="bd-coins-pill">{balance === undefined ? '…' : groupThousands(balance)}</span>
      <img className="bd-coins-coin" src={coin} alt="" />
    </Link>
  );
}
