import { useEffect, useState, type FormEvent } from 'react';

import { api, newIdempotencyKey } from '../../api/http';
import type { Wallet, WalletEntry, WalletMovement } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { hasRole } from '../../auth/roles';
import { useOnReconnect } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { dinarsToMillimes, formatDateTime, formatMillimes, formatSignedMillimes } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { entryText } from '../../shared/wallet';
import { useRecentMemberCodes } from './wallet';

const QUICK_DINARS = ['5', '10', '20', '50'];

/**
 * Electronic Wallet at the desk (brief §6.7). The backend keys every staff
 * wallet route by the gamer's profile id and has no gamer list, so the desk
 * opens a wallet with the gamer's member code (shown in their app, under
 * My profile). Top-ups and refunds are idempotent: a double click never
 * credits twice.
 */
export function WalletPage() {
  const { user } = useAuth();
  const canRefund = hasRole(user, 'MANAGER');
  const recent = useRecentMemberCodes();
  const [input, setInput] = useState('');
  const [code, setCode] = useState('');
  const wallet = useApiQuery<Wallet>(code ? `/wallets/${code}` : null);
  const entries = useApiQuery<WalletEntry[]>(code ? `/wallets/${code}/entries?take=50` : null);
  const action = useAction();
  const [amount, setAmount] = useState('10');
  const [topupKey, setTopupKey] = useState(newIdempotencyKey);

  function reload() {
    wallet.reload();
    entries.reload();
  }
  useOnReconnect(reload);

  function open(e?: FormEvent, value = input) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setCode(trimmed);
    setInput(trimmed);
    action.clear();
  }

  // Remember a code once it opened a real wallet.
  const openedId = wallet.data?.gamerProfileId;
  const { add } = recent;
  useEffect(() => {
    if (openedId) add(openedId);
  }, [openedId, add]);

  async function topup(e: FormEvent) {
    e.preventDefault();
    const millimes = dinarsToMillimes(amount);
    if (!millimes || millimes <= 0) return;
    const body: WalletMovement = { amount: millimes, type: 'CREDIT', idempotencyKey: topupKey };
    const entry = await action.run(
      'topup',
      () => api<WalletEntry>('POST', `/wallets/${code}/credit`, body),
      (x) => `Added ${formatMillimes(x.amount)}. New balance ${formatMillimes(x.balanceAfter)}.`,
    );
    if (entry) {
      setTopupKey(newIdempotencyKey());
      reload();
    }
  }

  async function refund(entry: WalletEntry) {
    if (!window.confirm(`Refund ${formatMillimes(-entry.amount)} to this gamer?`)) return;
    // Keyed on the refunded entry: refunding it twice is a no-op.
    const body: WalletMovement = {
      amount: -entry.amount,
      type: 'REFUND',
      sessionId: entry.sessionId ?? undefined,
      idempotencyKey: `refund:${entry.id}`,
    };
    const done = await action.run(
      entry.id,
      () => api<WalletEntry>('POST', `/wallets/${code}/credit`, body),
      (x) => `Refunded ${formatMillimes(x.amount)}. New balance ${formatMillimes(x.balanceAfter)}.`,
    );
    if (done) reload();
  }

  const lines = entries.data ?? [];

  return (
    <>
      <h1>Wallet</h1>
      <ActionMessages action={action} />

      <form className="toolbar" onSubmit={open}>
        <label htmlFor="w-code">Member code</label>{' '}
        <input id="w-code" size={40} placeholder="from the gamer's app, My profile" value={input} onChange={(e) => setInput(e.target.value)} />{' '}
        <button type="submit">Open wallet</button>
        {recent.codes.length > 0 && (
          <>
            <span className="sep-v" />
            <label htmlFor="w-recent">Recent</label>{' '}
            <select id="w-recent" value="" onChange={(e) => e.target.value && open(undefined, e.target.value)}>
              <option value="">— opened before —</option>
              {recent.codes.map((c) => (
                <option key={c} value={c}>
                  {c.slice(0, 8)}…
                </option>
              ))}
            </select>
          </>
        )}
      </form>

      {!code && <p className="muted">Ask the gamer for their member code: it is in their app under My profile.</p>}
      {code && <ErrorBox error={wallet.error ?? entries.error} />}

      {wallet.data && (
        <>
          <div className="big-figure">
            Balance
            <b className={wallet.data.balance <= 0 ? 'status-bad' : ''}>{formatMillimes(wallet.data.balance)}</b>
            <span className="muted">member {wallet.data.gamerProfileId.slice(0, 8)}…</span>
          </div>

          <form onSubmit={topup}>
            <fieldset>
              <legend>Top up (cash at the desk)</legend>
              <div className="form-row">
                <label htmlFor="w-amount">Amount (DT)</label>
                <input
                  id="w-amount"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />{' '}
                {QUICK_DINARS.map((q) => (
                  <button key={q} type="button" className="secondary" onClick={() => setAmount(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="form-row">
                <label />
                <button type="submit" disabled={action.busy === 'topup'}>
                  Add to wallet
                </button>
              </div>
            </fieldset>
          </form>

          <h2>History</h2>
          <table className="grid">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Amount</th>
                <th>Balance after</th>
                {canRefund && <th />}
              </tr>
            </thead>
            <tbody>
              {lines.map((x) => (
                <tr key={x.id}>
                  <td>{formatDateTime(x.createdAt)}</td>
                  <td>
                    {entryText(x)}
                    {x.sessionId && <span className="muted"> (session {x.sessionId.slice(0, 8)})</span>}
                  </td>
                  <td className={x.amount < 0 ? 'status-bad' : 'status-ok'}>{formatSignedMillimes(x.amount)}</td>
                  <td>{formatMillimes(x.balanceAfter)}</td>
                  {canRefund && (
                    <td>
                      {x.amount < 0 && (
                        <button type="button" className="secondary" disabled={action.busy === x.id} onClick={() => refund(x)}>
                          Refund
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!entries.loading && lines.length === 0 && (
                <tr>
                  <td colSpan={canRefund ? 5 : 4} className="muted">
                    No movement yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!canRefund && <p className="muted">Refunds are done by a branch admin.</p>}
        </>
      )}
    </>
  );
}
