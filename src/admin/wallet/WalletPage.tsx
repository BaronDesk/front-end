import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { api, newIdempotencyKey } from '../../api/http';
import type { TransactionType, Wallet, WalletTransaction } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { hasRole } from '../../auth/roles';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { CURRENCY, formatDateTime, formatMoney, formatSignedMoney } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { GamerSelect } from '../pickers';

const TYPE_LABEL: Record<TransactionType, string> = {
  TOPUP: 'Top-up',
  SESSION_CHARGE: 'Play time',
  BOOKING_FEE: 'Booking fee',
  MEMBERSHIP: 'Membership',
  SUBSCRIPTION: 'Hour pass',
  REFUND: 'Refund',
  REVERSAL: 'Reversal',
};

/** Electronic wallet (brief §6.7): balance, ledger, cash top-up, reversal. */
export function WalletPage() {
  const { user } = useAuth();
  const canReverse = hasRole(user, 'MANAGER');
  const [params, setParams] = useSearchParams();
  const gamerId = params.get('user') ?? '';

  const wallet = useApiQuery<Wallet>(gamerId ? `/wallet/${gamerId}` : null);
  const ledger = useApiQuery<WalletTransaction[]>(gamerId ? `/wallet/${gamerId}/transactions` : null);
  const action = useAction();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  // Generated once per top-up and reused if the same submit is retried (brief §12, rule 4).
  const [topupKey, setTopupKey] = useState(newIdempotencyKey);

  function reload() {
    wallet.reload();
    ledger.reload();
  }

  // A session ending (or a charge from another desk) changes the balance.
  useRealtimeEvent('session_update', (e) => {
    if (e.userId === gamerId && e.status === 'ENDED') reload();
  });
  useOnReconnect(() => gamerId && reload());

  async function topUp(e: FormEvent) {
    e.preventDefault();
    const tx = await action.run(
      'topup',
      () => api<WalletTransaction>('POST', `/wallet/${gamerId}/topup`, { amount: Number(amount), method, idempotencyKey: topupKey }),
      (t) => `Top-up of ${formatMoney(t.amount)} recorded. New balance ${formatMoney(t.balanceAfter)}.`,
    );
    if (tx) {
      setAmount('');
      setTopupKey(newIdempotencyKey());
      reload();
    }
  }

  async function reverse(tx: WalletTransaction) {
    const reason = window.prompt(`Reverse this ${TYPE_LABEL[tx.type].toLowerCase()} of ${formatMoney(tx.amount)}? Reason:`);
    if (!reason?.trim()) return;
    const done = await action.run(
      tx.id,
      () => api<WalletTransaction>('POST', `/transactions/${tx.id}/reverse`, { reason: reason.trim() }),
      (r) => `Reversed. New balance ${formatMoney(r.balanceAfter)}.`,
    );
    if (done) reload();
  }

  return (
    <>
      <h1>Wallet</h1>
      <div className="toolbar">
        <label htmlFor="w-gamer">Gamer</label>
        <GamerSelect
          id="w-gamer"
          value={gamerId}
          onChange={(v) => {
            action.clear();
            setParams(v ? { user: v } : {});
          }}
        />
        {gamerId && (
          <>
            {' '}
            <Link to={`/users/${gamerId}`}>Profile »</Link>
          </>
        )}
      </div>
      <ActionMessages action={action} />
      <ErrorBox error={wallet.error ?? ledger.error} />

      {!gamerId ? (
        <p className="muted">Choose a gamer to see their balance and transactions.</p>
      ) : (
        <>
          <div className="columns">
            <fieldset>
              <legend>Balance</legend>
              <div className="big-number">{wallet.loading && !wallet.data ? '…' : formatMoney(wallet.data?.balance)}</div>
            </fieldset>

            <form onSubmit={topUp}>
              <fieldset>
                <legend>Top up at the desk</legend>
                <div className="form-row">
                  <label htmlFor="w-amount">Amount ({CURRENCY})</label>
                  <input
                    id="w-amount"
                    type="number"
                    min="0.001"
                    max="500"
                    step="0.001"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="w-method">Paid by</label>
                  <select id="w-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
                <div className="form-row">
                  <label />
                  <button type="submit" disabled={action.busy === 'topup'}>
                    {action.busy === 'topup' ? 'Saving…' : 'Top up'}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>

          <h2>Transactions</h2>
          <table className="grid">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance after</th>
                <th>Paid by</th>
                <th>Note</th>
                {canReverse && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(ledger.data ?? []).map((t) => (
                <tr key={t.id} className={t.reversedById ? 'row-muted' : ''}>
                  <td className="nowrap">{formatDateTime(t.createdAt)}</td>
                  <td>{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className={t.amount >= 0 ? 'money-credit' : 'money-debit'}>{formatSignedMoney(t.amount)}</td>
                  <td>{formatMoney(t.balanceAfter)}</td>
                  <td>{t.method ?? '—'}</td>
                  <td>
                    {t.note ?? ''}
                    {t.reversedById && <i> (reversed)</i>}
                  </td>
                  {canReverse && (
                    <td>
                      {!t.reversedById && t.type !== 'REVERSAL' && (
                        <button type="button" className="secondary" disabled={action.busy === t.id} onClick={() => reverse(t)}>
                          Reverse
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!ledger.loading && (ledger.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
