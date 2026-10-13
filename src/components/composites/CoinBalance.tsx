import { Link } from 'react-router';

import { groupThousands } from '../../lib/format';
import coin from '../assets/coin.png';
import { cx } from '../../lib/cx';
import styles from './CoinBalance.module.css';

/** The gamer's coins in the Bookings header: a dark pill ending under the Baron coin ("30.000"); a link to `to` (the wallet). "…" while unknown. */
export function CoinBalance({ balance, to, className }: { balance: number | undefined; to: string; className?: string }) {
  return (
    <Link to={to} className={cx(styles.root, className)} aria-label={balance === undefined ? 'My wallet' : `My wallet: ${balance} coins`}>
      <span className={styles.pill}>{balance === undefined ? '…' : groupThousands(balance)}</span>
      <img className={styles.coin} src={coin} alt="" />
    </Link>
  );
}
