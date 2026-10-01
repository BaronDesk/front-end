import { useState } from 'react';

import { api, newIdempotencyKey } from '../../api/http';
import type { Membership, MembershipPlan, Subscription, SubscriptionPlan, Wallet } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime, formatMillimes, formatMoney } from '../../shared/format';
import { benefitsText, discountText } from '../../shared/plans';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';

/**
 * My profile & plans (brief §6.9): the active membership
 * and passes, and buying one with the wallet (the purchase is idempotent).
 */
export function ProfilePage() {
  const { user } = useAuth();
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const memberships = useApiQuery<Membership[]>('/memberships/me');
  const subscriptions = useApiQuery<Subscription[]>('/subscriptions/me');
  const tiers = useApiQuery<MembershipPlan[]>('/membership-plans');
  const passes = useApiQuery<SubscriptionPlan[]>('/subscription-plans');
  const action = useAction();
  // One key per plan and page visit: a double tap never buys twice.
  const [keys] = useState(() => new Map<string, string>());
  const keyFor = (id: string) => keys.get(id) ?? keys.set(id, newIdempotencyKey()).get(id)!;

  const activeTier = (memberships.data ?? []).find((m) => m.status === 'ACTIVE');
  const currentTierPrice = Number(activeTier?.membershipPlan?.price ?? 0);
  const activePasses = (subscriptions.data ?? []).filter((s) => s.status === 'ACTIVE');

  async function cancelMembership() {
    if (!window.confirm('Cancel your membership now? There is no refund: its discount stops today.')) return;
    const done = await action.run('cancel', () => api('POST', '/memberships/me/cancel').then(() => true), 'Membership cancelled.');
    if (done) memberships.reload();
  }

  async function buy(kind: 'membership' | 'subscription', plan: MembershipPlan | SubscriptionPlan) {
    const upgrade = kind === 'membership' && Boolean(activeTier);
    const question = upgrade
      ? `Upgrade to ${plan.name}? You pay ${formatMoney(plan.price)} minus what is left of your current tier, from your wallet.`
      : `Buy ${plan.name} for ${formatMoney(plan.price)}? It is paid from your wallet.`;
    if (!window.confirm(question)) return;
    const done = await action.run(
      plan.id,
      () => api(`POST`, `/${kind}-plans/${plan.id}/purchase`, { idempotencyKey: keyFor(plan.id) }).then(() => true),
      `${plan.name} is yours.`,
    );
    if (done) {
      keys.delete(plan.id);
      memberships.reload();
      subscriptions.reload();
      wallet.reload();
    }
  }

  return (
    <>
      <h1>My profile &amp; plans</h1>
      <ActionMessages action={action} />
      <ErrorBox error={wallet.error ?? memberships.error ?? subscriptions.error ?? tiers.error ?? passes.error} />

      <table className="kv">
        <tbody>
          <tr>
            <th>Username</th>
            <td>{user?.username}</td>
          </tr>
          <tr>
            <th>Balance</th>
            <td>{wallet.data ? formatMillimes(wallet.data.balance) : '…'}</td>
          </tr>
          <tr>
            <th>Membership</th>
            <td>
              {activeTier ? (
                <>
                  <b>{activeTier.membershipPlan?.name ?? 'Member'}</b> {discountText(activeTier.discountPercentSnapshot)} on play, until{' '}
                  {formatDateTime(activeTier.endDate)}{' '}
                  <button type="button" className="secondary" disabled={action.busy === 'cancel'} onClick={cancelMembership}>
                    Cancel
                  </button>
                </>
              ) : (
                <span className="muted">none</span>
              )}
            </td>
          </tr>
          <tr>
            <th>Passes</th>
            <td>
              {activePasses.length ? (
                activePasses.map((s) => (
                  <div key={s.id}>
                    <b>{s.subscriptionPlan?.name ?? 'Pass'}</b>: {benefitsText(s.benefitsSnapshot)}, until {formatDateTime(s.endDate)}
                  </div>
                ))
              ) : (
                <span className="muted">none</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Membership tiers</h2>
      <table className="grid">
        <tbody>
          {(tiers.data ?? []).map((p) => (
            <tr key={p.id}>
              <td>
                <b>{p.name}</b>
                <div className="muted">
                  {discountText(p.discountPercent)} on play · book {p.bookingAdvanceDays} days ahead · {p.durationDays} days
                </div>
              </td>
              <td>{formatMoney(p.price)}</td>
              <td>
                {activeTier?.membershipPlanId === p.id ? (
                  <span className="status-ok">yours</span>
                ) : activeTier && Number(p.price) <= currentTierPrice ? (
                  <span className="muted">—</span>
                ) : (
                  <button type="button" disabled={action.busy === p.id} onClick={() => buy('membership', p)}>
                    {activeTier ? 'Upgrade' : 'Buy'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {activeTier && (
        <p className="muted">
          One membership at a time. Upgrading to a higher tier costs its price minus what is left of yours (by days); a lower tier can be
          bought when yours ends.
        </p>
      )}

      <h2>Passes</h2>
      <table className="grid">
        <tbody>
          {(passes.data ?? []).map((p) => (
            <tr key={p.id}>
              <td>
                <b>{p.name}</b>
                <div className="muted">
                  {benefitsText(p.benefits)} · {p.durationDays} days
                </div>
              </td>
              <td>{formatMoney(p.price)}</td>
              <td>
                {activePasses.some((s) => s.subscriptionPlanId === p.id) ? (
                  <span className="status-ok">yours</span>
                ) : (
                  <button type="button" disabled={action.busy === p.id} onClick={() => buy('subscription', p)}>
                    Buy
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
