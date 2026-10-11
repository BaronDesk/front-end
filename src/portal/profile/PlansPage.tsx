import { useState } from 'react';

import { api, newIdempotencyKey } from '../../api/http';
import { imageSrc } from '../../api/images';
import type { Membership, MembershipPlan, Pricing, Subscription, SubscriptionPlan, Wallet } from '../../api/types';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { groupThousands } from '../../shared/lib/format';
import { passLines, tierLines } from '../../shared/lib/plans';
import { ActionNote } from '../ui/ActionNote';
import { PlanCard } from '../ui/PlanCard';

const pad = (n: number) => String(n).padStart(2, '0');
const dayText = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const priceText = (coins: number) => (coins === 0 ? 'Free' : `${groupThousands(coins)} coins`);

/**
 * Memberships & passes (Settings → See All, Profile's badges), in the design's
 * style: every tier and pass as a Settings plan card with its price and a
 * button. Paid from the wallet; a purchase is idempotent (a double tap never
 * buys twice). A dearer tier is an Upgrade (its price minus what is left of
 * the current one); Cancel ends the tier at once, without a refund.
 */
export function PlansPage() {
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const memberships = useApiQuery<Membership[]>('/memberships/me');
  const subscriptions = useApiQuery<Subscription[]>('/subscriptions/me');
  const tiers = useApiQuery<MembershipPlan[]>('/membership-plans');
  const passes = useApiQuery<SubscriptionPlan[]>('/subscription-plans');
  const pricing = useApiQuery<Pricing>('/pricing');
  const action = useAction();
  // One key per plan and page visit: a double tap never buys twice.
  const [keys] = useState(() => new Map<string, string>());
  const keyFor = (id: string) => keys.get(id) ?? keys.set(id, newIdempotencyKey()).get(id)!;

  const activeTier = (memberships.data ?? []).find((m) => m.status === 'ACTIVE');
  const currentTierPrice = Number(activeTier?.membershipPlan?.price ?? 0);
  const activePasses = (subscriptions.data ?? []).filter((s) => s.status === 'ACTIVE');
  const tierList = [...(tiers.data ?? [])].sort((a, b) => a.price - b.price);
  const passList = [...(passes.data ?? [])].sort((a, b) => a.price - b.price);

  async function cancelMembership() {
    if (!window.confirm('Cancel your membership now? There is no refund: its discount stops today.')) return;
    const done = await action.run('cancel', () => api('POST', '/memberships/me/cancel').then(() => true), 'Membership cancelled.');
    if (done) memberships.reload();
  }

  async function buy(kind: 'membership' | 'subscription', plan: MembershipPlan | SubscriptionPlan) {
    const upgrade = kind === 'membership' && Boolean(activeTier);
    const question = upgrade
      ? `Upgrade to ${plan.name}? You pay ${priceText(plan.price)} minus what is left of your current tier, from your wallet.`
      : `Buy ${plan.name} for ${priceText(plan.price)}? It is paid from your wallet.`;
    if (!window.confirm(question)) return;
    const done = await action.run(
      plan.id,
      () => api('POST', `/${kind}-plans/${plan.id}/purchase`, { idempotencyKey: keyFor(plan.id) }).then(() => true),
      `${plan.name} is yours.`,
    );
    if (done) {
      keys.delete(plan.id);
      memberships.reload();
      subscriptions.reload();
      wallet.reload();
    }
  }

  /** A tier's button: yours (the active one, or the free one without a paid tier), Upgrade, Buy, or none for a cheaper tier. */
  function tierButton(p: MembershipPlan) {
    const yours = activeTier ? activeTier.membershipPlanId === p.id : p.price === 0;
    if (yours) return <span className="bd-plan-yours">Yours</span>;
    if (activeTier && p.price <= currentTierPrice) return null;
    return (
      <button type="button" className="bd-btn-small" disabled={action.busy === p.id} onClick={() => buy('membership', p)}>
        {activeTier ? 'Upgrade' : 'Buy'}
      </button>
    );
  }

  return (
    <div className="bd-page">
      <h1 className="bd-book-title">
        Memberships
        <br />& Passes
      </h1>
      <p className="bd-plans-balance">
        Your balance: <b>{wallet.data ? priceText(wallet.data.balance) : '…'}</b>
      </p>
      <ActionNote action={action} />

      {activeTier && activeTier.membershipPlan && activeTier.membershipPlan.price > 0 && (
        <div className="bd-card bd-plans-current">
          <p>
            Your membership: <b>{activeTier.membershipPlan.name}</b>, until {dayText(activeTier.endDate)}.
          </p>
          <button type="button" className="bd-btn-small bd-btn-danger" disabled={action.busy === 'cancel'} onClick={cancelMembership}>
            Cancel
          </button>
        </div>
      )}

      <h2 className="bd-section-head bd-plans-head">Memberships</h2>
      <div className="bd-plans-list">
        {tierList.map((p) => (
          <PlanCard
            key={p.id}
            badge={imageSrc(p.badgeUrl)}
            size={184}
            at={[-33, -15]}
            corner={40}
            tier
            title={p.name}
            lines={tierLines(p.discountPercent, pricing.data?.bookingRate ?? null)}
            footer={
              <>
                <span className="bd-plan-price">
                  {priceText(p.price)}
                  <small> · book {p.bookingAdvanceDays} {p.bookingAdvanceDays === 1 ? 'day' : 'days'} ahead</small>
                </span>
                {tierButton(p)}
              </>
            }
          />
        ))}
      </div>
      {activeTier && (
        <p className="bd-note">One membership at a time: a dearer tier costs its price minus what is left of yours; a cheaper one can be bought when yours ends.</p>
      )}

      <h2 className="bd-section-head bd-plans-head">Passes</h2>
      <div className="bd-plans-list">
        {passList.map((p) => {
          const owned = activePasses.find((s) => s.subscriptionPlanId === p.id);
          return (
            <PlanCard
              key={p.id}
              badge={imageSrc(p.badgeUrl)}
              size={179}
              at={[-34, -24]}
              corner={45}
              title={p.name}
              lines={passLines(p.benefits)}
              footer={
                <>
                  <span className="bd-plan-price">
                    {priceText(p.price)}
                    <small> · {owned ? `until ${dayText(owned.endDate)}` : `${p.durationDays} days`}</small>
                  </span>
                  {owned ? (
                    <span className="bd-plan-yours">Yours</span>
                  ) : (
                    <button type="button" className="bd-btn-small" disabled={action.busy === p.id} onClick={() => buy('subscription', p)}>
                      Buy
                    </button>
                  )}
                </>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
