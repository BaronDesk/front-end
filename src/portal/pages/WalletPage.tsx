import type { Wallet, WalletEntry } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime, formatMillimes, formatSignedMillimes } from '../../shared/format';
import { useApiQuery } from '../../shared/useApiQuery';
import { entryText } from '../../shared/wallet';

/**
 * Own balance and history (brief §6.7). Top-ups are made at the desk, which
 * finds the gamer by username: nothing to copy.
 */
export function WalletPage() {
  const { user } = useAuth();
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const entries = useApiQuery<WalletEntry[]>('/wallets/me/entries?take=30');
  const w = wallet.data;

  return (
    <>
      <h1>My wallet</h1>
      <ErrorBox error={wallet.error ?? entries.error} />
      <div className="big-figure">
        Balance
        <b className={w && w.balance <= 0 ? 'status-bad' : ''}>{w ? formatMillimes(w.balance) : '…'}</b>
      </div>

      <div className="msg">
        <b>Top up at the desk:</b> give them your username, <b>{user?.username}</b>.
      </div>

      <h2>History</h2>
      <table className="grid">
        <thead>
          <tr>
            <th>When</th>
            <th>What</th>
            <th>Amount</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {(entries.data ?? []).map((x) => (
            <tr key={x.id}>
              <td>{formatDateTime(x.createdAt)}</td>
              <td>{entryText(x)}</td>
              <td className={x.amount < 0 ? 'status-bad' : 'status-ok'}>{formatSignedMillimes(x.amount)}</td>
              <td>{formatMillimes(x.balanceAfter)}</td>
            </tr>
          ))}
          {!entries.loading && !entries.data?.length && (
            <tr>
              <td colSpan={4} className="muted">
                No movement yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
