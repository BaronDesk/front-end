import { useState, type FormEvent } from 'react';

import { api, newIdempotencyKey } from '../../api/http';
import type { PublicUser, Wallet, WalletEntry, WalletMovement } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { hasRole } from '../../auth/roles';
import { useOnReconnect } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { Thumb } from '../../shared/components/Thumb';
import { coinsInCurrency, CURRENCY, currencyToCoins, formatCoins, formatDateTime, formatSignedCoins } from '../../shared/lib/format';
import { ActionMessages } from '../../shared/components/ActionMessages';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { entryText } from '../../shared/lib/wallet';
import { useBranchScope } from '../branches/BranchContext';
import { exactMatch, toWalletGamers, useRecentGamers, type WalletGamer } from './gamerSearch';
import { EmptyRow } from '../../shared/components/EmptyRow';

/** Common cash amounts at the desk. */
const QUICK_CASH = ['5', '10', '20', '50'];

/**
 * Electronic Wallet at the desk (brief §6.7). The desk finds the gamer by
 * username (GET /gamers?q=, the name shown in their app); every wallet route
 * is then keyed by the gamer's profile id. Top-ups and refunds are
 * idempotent: a double click never credits twice.
 */
export function WalletPage() {
  const { user } = useAuth();
  const canRefund = hasRole(user, 'MANAGER');
  const { branchName } = useBranchScope();
  const recent = useRecentGamers();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<PublicUser[] | null>(null);
  const [picked, setPicked] = useState<WalletGamer | null>(null);
  const code = picked?.gamerProfileId ?? '';
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

  function open(gamer: WalletGamer) {
    setPicked(gamer);
    setResults(null);
    recent.add(gamer);
    action.clear();
  }

  // An exact username opens the wallet at once; otherwise the desk picks from the matches.
  async function search(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    const users = await action.run('search', () => api<PublicUser[]>('GET', `/gamers?q=${encodeURIComponent(q)}`));
    if (!users) return;
    const gamers = users.filter((u) => u.gamerProfileId);
    const exact = exactMatch(toWalletGamers(gamers), q);
    if (exact) open(exact);
    else setResults(gamers);
  }

  async function topup(e: FormEvent) {
    e.preventDefault();
    const coins = currencyToCoins(amount);
    if (!coins || coins <= 0) return;
    const body: WalletMovement = { amount: coins, type: 'CREDIT', idempotencyKey: topupKey };
    const entry = await action.run(
      'topup',
      () => api<WalletEntry>('POST', `/wallets/${code}/credit`, body),
      (x) => `Added ${formatCoins(x.amount)} (${coinsInCurrency(x.amount)}). New balance ${formatCoins(x.balanceAfter)}.`,
    );
    if (entry) {
      setTopupKey(newIdempotencyKey());
      reload();
    }
  }

  async function refund(entry: WalletEntry) {
    if (!window.confirm(`Refund ${formatCoins(-entry.amount)} to this gamer?`)) return;
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
      (x) => `Refunded ${formatCoins(x.amount)}. New balance ${formatCoins(x.balanceAfter)}.`,
    );
    if (done) reload();
  }

  const lines = entries.data ?? [];
  const topupCoins = currencyToCoins(amount);

  return (
    <>
      <h1>Wallet</h1>
      <ActionMessages action={action} />

      <form className="toolbar" onSubmit={search}>
        <label htmlFor="w-user">Gamer username</label>{' '}
        <input id="w-user" size={24} placeholder="as shown in their app" value={input} onChange={(e) => setInput(e.target.value)} />{' '}
        <button type="submit" disabled={action.busy === 'search'}>
          Find
        </button>
        {recent.gamers.length > 0 && (
          <>
            <span className="sep-v" />
            <label htmlFor="w-recent">Recent</label>{' '}
            <select
              id="w-recent"
              value=""
              onChange={(e) => {
                const g = recent.gamers.find((x) => x.gamerProfileId === e.target.value);
                if (g) open(g);
              }}
            >
              <option value="">— opened before —</option>
              {recent.gamers.map((g) => (
                <option key={g.gamerProfileId} value={g.gamerProfileId}>
                  {g.username}
                </option>
              ))}
            </select>
          </>
        )}
      </form>

      {results && (
        <table className="grid">
          <thead>
            <tr>
              <th>Gamer</th>
              <th>Home branch</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {results.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="with-thumb">
                    <Thumb url={u.avatarUrl} size={24} round />
                    <b>{u.username}</b>
                  </span>
                  {u.accountStatus !== 'ACTIVE' && <span className="status-bad"> ({u.accountStatus.toLowerCase()})</span>}
                </td>
                <td>{u.homeBranchId ? branchName(u.homeBranchId) : <span className="muted">—</span>}</td>
                <td>
                  <button type="button" onClick={() => open({ gamerProfileId: u.gamerProfileId!, username: u.username })}>
                    Open wallet
                  </button>
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <EmptyRow colSpan={3}>No gamer matches “{input.trim()}”.</EmptyRow>
            )}
          </tbody>
        </table>
      )}

      {!code && !results && <p className="muted">Ask the gamer for their username: it is shown in their app, under Wallet.</p>}
      {code && <ErrorBox error={wallet.error ?? entries.error} />}

      {wallet.data && (
        <>
          <div className="big-figure">
            Balance
            <b className={wallet.data.balance <= 0 ? 'status-bad' : ''}>{formatCoins(wallet.data.balance)}</b>
            <span className="muted">{picked?.username}</span>
          </div>

          <form onSubmit={topup}>
            <fieldset>
              <legend>Top up (cash at the desk)</legend>
              <div className="form-row">
                <label htmlFor="w-amount">Cash taken ({CURRENCY})</label>
                <input
                  id="w-amount"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />{' '}
                {QUICK_CASH.map((q) => (
                  <button key={q} type="button" className="secondary" onClick={() => setAmount(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="form-row">
                <label />
                <button type="submit" disabled={action.busy === 'topup'}>
                  Add {topupCoins ? `${formatCoins(topupCoins)} ` : ''}to wallet
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
                  <td className={x.amount < 0 ? 'status-bad' : 'status-ok'}>{formatSignedCoins(x.amount)}</td>
                  <td>{formatCoins(x.balanceAfter)}</td>
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
                <EmptyRow colSpan={canRefund ? 5 : 4}>No movement yet.</EmptyRow>
              )}
            </tbody>
          </table>
          {!canRefund && <p className="muted">Refunds are done by a branch admin.</p>}
        </>
      )}
    </>
  );
}
