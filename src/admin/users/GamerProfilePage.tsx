import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { api, newIdempotencyKey } from '../../api/http';
import type { GamerProfile, Membership, MembershipPlan, PublicUser, Subscription, SubscriptionPlan, Wallet } from '../../api/types';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime, formatMoney } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';

/** Gamer profile: level/xp, wallet, membership tier and passes (brief §6.9–10). */
export function GamerProfilePage() {
  const { id = '' } = useParams();
  const user = useApiQuery<PublicUser>(`/users/${id}`);
  const profile = useApiQuery<GamerProfile>(`/users/${id}/profile`);
  const wallet = useApiQuery<Wallet>(`/wallet/${id}`);
  const membership = useApiQuery<Membership | null>(`/users/${id}/membership`);
  const passes = useApiQuery<Subscription[]>(`/users/${id}/subscriptions`);
  const tiers = useApiQuery<MembershipPlan[]>('/membership-plans');
  const passPlans = useApiQuery<SubscriptionPlan[]>('/subscription-plans');
  const action = useAction();

  const [tierId, setTierId] = useState('');
  const [passId, setPassId] = useState('');
  // One key per purchase; kept on failure so a retry can't charge twice.
  const [tierKey, setTierKey] = useState(newIdempotencyKey);
  const [passKey, setPassKey] = useState(newIdempotencyKey);

  if (user.error && !user.data) return <ErrorBox error={user.error} />;
  const u = user.data;
  if (!u) return <p className="muted">Loading…</p>;

  const activePasses = (passes.data ?? []).filter((p) => Date.parse(p.endsAt) > Date.now() && p.hoursLeft > 0);
  const tier = tiers.data?.find((t) => t.id === tierId);
  const passPlan = passPlans.data?.find((p) => p.id === passId);

  async function giveTier() {
    const done = await action.run(
      'tier',
      () => api<Membership>('POST', '/memberships', { userId: id, planId: tierId, idempotencyKey: tierKey }),
      (m) => `${m.planName} membership given (−${m.discountPercent} % on play time).`,
    );
    if (done) {
      setTierId('');
      setTierKey(newIdempotencyKey());
      membership.reload();
      wallet.reload();
    }
  }

  async function cancelTier(m: Membership) {
    if (!window.confirm(`Cancel the ${m.planName} membership? It is not refunded.`)) return;
    const done = await action.run('tier', () => api('DELETE', `/memberships/${m.id}`).then(() => true), 'Membership cancelled.');
    if (done) membership.reload();
  }

  async function buyPass() {
    const done = await action.run(
      'pass',
      () => api<Subscription>('POST', '/subscriptions', { userId: id, planId: passId, idempotencyKey: passKey }),
      (s) => `${s.planName} added (${s.hoursLeft} h).`,
    );
    if (done) {
      setPassId('');
      setPassKey(newIdempotencyKey());
      passes.reload();
      wallet.reload();
    }
  }

  async function cancelPass(p: Subscription) {
    if (!window.confirm(`Cancel ${p.planName}? Remaining hours are lost.`)) return;
    const done = await action.run('pass', () => api('DELETE', `/subscriptions/${p.id}`).then(() => true), 'Pass cancelled.');
    if (done) passes.reload();
  }

  const m = membership.data;

  return (
    <>
      <p>
        <Link to="/users">« Back to users</Link>
      </p>
      <h1>Gamer {u.username}</h1>
      <ActionMessages action={action} />

      <table className="kv">
        <tbody>
          <tr>
            <th>Account</th>
            <td className={u.accountStatus === 'ACTIVE' ? '' : 'status-bad'}>{u.accountStatus}</td>
          </tr>
          <tr>
            <th>Level / XP</th>
            <td>{profile.data ? `Level ${profile.data.level} · ${profile.data.xp} xp` : '—'}</td>
          </tr>
          <tr>
            <th>Wallet</th>
            <td>
              <b>{formatMoney(wallet.data?.balance)}</b> &nbsp; <Link to={`/wallet?user=${id}`}>Open wallet »</Link>
            </td>
          </tr>
          <tr>
            <th>Joined</th>
            <td>{formatDateTime(u.createdAt)}</td>
          </tr>
        </tbody>
      </table>

      <div className="columns">
        <fieldset>
          <legend>Membership tier</legend>
          {m ? (
            <>
              <p>
                <b>{m.planName}</b>: −{m.discountPercent} % on play time, until {formatDateTime(m.endsAt)}.
              </p>
              <button type="button" className="secondary" disabled={action.busy === 'tier'} onClick={() => cancelTier(m)}>
                Cancel membership
              </button>
            </>
          ) : (
            <>
              <p className="muted">No membership.</p>
              <div className="form-row">
                <select aria-label="Membership tier" value={tierId} onChange={(e) => setTierId(e.target.value)}>
                  <option value="">— choose a tier —</option>
                  {(tiers.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}: −{t.discountPercent} %, {formatMoney(t.price)} / {t.durationDays} days
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" disabled={!tierId || action.busy === 'tier'} onClick={giveTier}>
                {tier ? `Give ${tier.name} (debits ${formatMoney(tier.price)})` : 'Give membership'}
              </button>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Hour passes</legend>
          {activePasses.length === 0 ? (
            <p className="muted">No active pass.</p>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th>Pass</th>
                  <th>Hours left</th>
                  <th>Until</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {activePasses.map((p) => (
                  <tr key={p.id}>
                    <td>{p.planName}</td>
                    <td>{p.hoursLeft} h</td>
                    <td>{formatDateTime(p.endsAt)}</td>
                    <td>
                      <button type="button" className="secondary" disabled={action.busy === 'pass'} onClick={() => cancelPass(p)}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="form-row" style={{ marginTop: 8 }}>
            <select aria-label="Pass" value={passId} onChange={(e) => setPassId(e.target.value)}>
              <option value="">— choose a pass —</option>
              {(passPlans.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}: {p.hoursIncluded} h, {formatMoney(p.price)} / {p.durationDays} days
                </option>
              ))}
            </select>
          </div>
          <button type="button" disabled={!passId || action.busy === 'pass'} onClick={buyPass}>
            {passPlan ? `Add ${passPlan.name} (debits ${formatMoney(passPlan.price)})` : 'Add pass'}
          </button>
        </fieldset>
      </div>
    </>
  );
}
