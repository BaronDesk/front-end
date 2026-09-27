import { useState, type FormEvent } from 'react';

import { api, newIdempotencyKey } from '../../api/http';
import type { Wallet, WalletTransaction } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime, formatMoney, formatSignedMoney } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';

const QUICK_AMOUNTS = [5, 10, 20, 50];

const TYPE_TEXT: Record<WalletTransaction['type'], string> = {
  TOPUP: 'Top-up',
  SESSION_CHARGE: 'Play time',
  BOOKING_FEE: 'Booking fee',
  MEMBERSHIP: 'Membership',
  SUBSCRIPTION: 'Pass',
  REFUND: 'Refund',
  REVERSAL: 'Correction',
};

/** Own balance, self top-up and history (brief §6.7). */
export function WalletPage() {
  const { user } = useAuth();
  const id = user?.id ?? '';
  const wallet = useApiQuery<Wallet>(`/wallet/${id}`);
  const ledger = useApiQuery<WalletTransaction[]>(`/wallet/${id}/transactions`);
  const action = useAction();
  const [amount, setAmount] = useState('10');
  const [topupKey, setTopupKey] = useState(newIdempotencyKey);

  function reload() {
    wallet.reload();
    ledger.reload();
  }
  // A session ending charges the wallet.
  useRealtimeEvent('session_update', (e) => e.userId === id && e.status === 'ENDED' && reload());
  useOnReconnect(reload);

  async function topup(e: FormEvent) {
    e.preventDefault();
    const tx = await action.run(
      'topup',
      () => api<WalletTransaction>('POST', `/wallet/${id}/topup`, { amount: Number(amount), idempotencyKey: topupKey }),
      (t) => `Added ${formatMoney(t.amount)}. New balance ${formatMoney(t.balanceAfter)}.`,
    );
    if (tx) {
      setTopupKey(newIdempotencyKey());
      reload();
    }
  }

  const lines = [...(ledger.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <h1>My wallet</h1>
      <ErrorBox error={wallet.error} />
      <div className="big-figure">
        Balance
        <b className={wallet.data && wallet.data.balance <= 0 ? 'status-bad' : ''}>{wallet.data ? formatMoney(wallet.data.balance) : '…'}</b>
      </div>

      <ActionMessages action={action} />
      <form onSubmit={topup}>
        <fieldset>
          <legend>Top up</legend>
          <div className="quick-amounts">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                className={String(a) === amount ? '' : 'secondary'}
                onClick={() => {
                  setAmount(String(a));
                  setTopupKey(newIdempotencyKey());
                }}
              >
                {a} DT
              </button>
            ))}
          </div>
          <div className="form-row">
            <label htmlFor="tu-amount">Amount (DT)</label>
            <input
              id="tu-amount"
              type="number"
              inputMode="decimal"
              min="0.5"
              max="500"
              step="0.5"
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setTopupKey(newIdempotencyKey());
              }}
            />
          </div>
          <button type="submit" className="wide" disabled={action.busy === 'topup'}>
            {action.busy === 'topup' ? 'Paying…' : `Pay ${amount || 0} DT`}
          </button>
          <p className="muted">Online payment. You can also pay cash at the desk.</p>
        </fieldset>
      </form>

      <h2>History</h2>
      <ErrorBox error={ledger.error} />
      {lines.length === 0 && <p className="muted">{ledger.loading ? 'Loading…' : 'Nothing yet.'}</p>}
      {lines.length > 0 && (
        <table className="grid">
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((t) => (
              <tr key={t.id}>
                <td className="nowrap">{formatDateTime(t.createdAt)}</td>
                <td>
                  {TYPE_TEXT[t.type] ?? t.type}
                  {t.note && <div className="muted">{t.note}</div>}
                </td>
                <td className={`num nowrap ${t.amount < 0 ? 'status-bad' : 'status-ok'}`}>{formatSignedMoney(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
