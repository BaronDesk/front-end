import type { Wallet, WalletEntry } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { groupThousands } from '../../shared/lib/format';
import { entryText } from '../../shared/lib/wallet';
import { WalletCard } from '../ui/WalletCard';

const pad = (n: number) => String(n).padStart(2, '0');
const when = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${groupThousands(Math.abs(n))}`;

/**
 * My wallet (brief §6.7; Profile's wallet card, Bookings' coins), in the
 * design's style: the balance, how to top up (at the desk, which finds the
 * gamer by username) and the latest movements.
 */
export function WalletPage() {
  const { user } = useAuth();
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const entries = useApiQuery<WalletEntry[]>('/wallets/me/entries?take=30');
  const list = entries.data ?? [];

  return (
    <div className="bd-page">
      <h1 className="bd-book-title">My Wallet</h1>
      <div className="bd-wallet-page-card">
        <WalletCard balance={wallet.data?.balance} />
      </div>

      <p className="bd-card bd-wallet-topup">
        <b>Top up at the desk:</b> pay in cash and give them your username, <b>{user?.username}</b>. 1000 coins = 1 DT.
      </p>

      <h2 className="bd-section-head bd-plans-head">History</h2>
      <div className="bd-entries">
        {list.map((x) => (
          <article key={x.id} className="bd-card bd-entry">
            <div>
              <p className="bd-entry-what">{entryText(x)}</p>
              <p className="bd-entry-when">{when(x.createdAt)}</p>
            </div>
            <div className="bd-entry-right">
              <p className={x.amount < 0 ? 'bd-entry-amount bd-entry-out' : 'bd-entry-amount'}>{signed(x.amount)}</p>
              <p className="bd-entry-when">balance {groupThousands(x.balanceAfter)}</p>
            </div>
          </article>
        ))}
        {entries.data && list.length === 0 && <p className="bd-card">No movement yet.</p>}
        {Boolean(wallet.error ?? entries.error) && <p className="bd-note bd-note-error">Your wallet could not be loaded.</p>}
      </div>
    </div>
  );
}
