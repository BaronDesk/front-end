import { useState } from 'react';

import { newIdempotencyKey } from '../../../../core/http/client';
import { plansService } from '../../../../services/plans.service';
import { imageSrc } from '../../../../lib/images';
import type { MembershipPlan, SubscriptionPlan } from '../../../../core/api-types';
import { useAction } from '../../../../hooks/useAction';
import { useMembershipPlans, useMyMemberships, useMySubscriptions, useMyWallet, usePasses, usePricing } from '../../../../hooks/queries';
import { dayDate } from '../../../../lib/dates';
import { groupThousands } from '../../../../lib/format';
import { passLines, tierLines } from '../../../../domain/plans';
import { ActionNote, Notice } from '../../../../components/primitives/Notice';
import { CoinBalance } from '../../../../components/composites/CoinBalance';
import { PlanCard } from '../../../../components/composites/PlanCard';
import { Button } from '../../../../components/primitives/Button';
import { Card } from '../../../../components/primitives/Card';
import { SectionTitle } from '../../../../components/primitives/SectionTitle';
import { PageTitle } from '../../../../components/primitives/PageTitle';
import { Page } from '../../../../components/layout/Page';
import styles from './PlansPage.module.css';

const priceText = (coins: number) => (coins === 0 ? 'Free' : `${groupThousands(coins)} coins`);

/**
 * Memberships & passes (Settings → See All, Profile's badges), in the design's
 * style: every tier and pass as a Settings plan card with its price and a
 * button. Paid from the wallet; a purchase is idempotent (a double tap never
 * buys twice). A dearer tier is an Upgrade (its price minus what is left of
 * the current one); Cancel ends the tier at once, without a refund.
 */
export function PlansPage() {
  const wallet = useMyWallet();
  const memberships = useMyMemberships();
  const subscriptions = useMySubscriptions();
  const tiers = useMembershipPlans();
  const passes = usePasses();
  const pricing = usePricing();
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
    const done = await action.run('cancel', () => plansService.cancelMembership(), 'Membership cancelled.');
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
      () => plansService.buy(kind, plan.id, keyFor(plan.id)),
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
    if (yours) return <span className={styles.planYours}>Yours</span>;
    if (activeTier && p.price <= currentTierPrice) return null;
    return (
      <Button size="sm" disabled={action.busy === p.id} onClick={() => buy('membership', p)}>
        {activeTier ? 'Upgrade' : 'Buy'}
      </Button>
    );
  }

  return (
    <Page>
      <PageTitle>
        Memberships
        <br />& Passes
      </PageTitle>
      <CoinBalance className={styles.coins} balance={wallet.data?.balance} to="/wallet" />
      <ActionNote action={action} />

      {activeTier && activeTier.membershipPlan && activeTier.membershipPlan.price > 0 && (
        <Card className={styles.current}>
          <p>
            Your membership: <b>{activeTier.membershipPlan.name}</b>, until {dayDate(activeTier.endDate)}.
          </p>
          <Button size="sm" variant="danger" disabled={action.busy === 'cancel'} onClick={cancelMembership}>
            Cancel
          </Button>
        </Card>
      )}

      <SectionTitle className={styles.head}>Memberships</SectionTitle>
      <div className={styles.list}>
        {tierList.map((p) => (
          <PlanCard
            key={p.id}
            badge={imageSrc(p.badgeUrl)}
            size={184}
            at={[-33, -31]}
            corner={40}
            tier
            title={p.name}
            lines={tierLines(p.discountPercent, pricing.data?.bookingRate ?? null)}
            footer={
              <>
                <span className={styles.planPrice}>
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
        <Notice>One membership at a time: a dearer tier costs its price minus what is left of yours; a cheaper one can be bought when yours ends.</Notice>
      )}

      <SectionTitle className={styles.head}>Passes</SectionTitle>
      <div className={styles.list}>
        {passList.map((p) => {
          const owned = activePasses.find((s) => s.subscriptionPlanId === p.id);
          return (
            <PlanCard
              key={p.id}
              badge={imageSrc(p.badgeUrl)}
              size={179}
              at={[-34, -40]}
              corner={45}
              title={p.name}
              lines={passLines(p.benefits)}
              footer={
                <>
                  <span className={styles.planPrice}>
                    {priceText(p.price)}
                    <small> · {owned ? `until ${dayDate(owned.endDate)}` : `${p.durationDays} days`}</small>
                  </span>
                  {owned ? (
                    <span className={styles.planYours}>Yours</span>
                  ) : (
                    <Button size="sm" disabled={action.busy === p.id} onClick={() => buy('subscription', p)}>
                      Buy
                    </Button>
                  )}
                </>
              }
            />
          );
        })}
      </div>
    </Page>
  );
}
