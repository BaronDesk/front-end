import { api } from '../core/http/client';
import type { MembershipPlan, MembershipPlanInput, Pricing, SubscriptionPlan, SubscriptionPlanInput } from '../core/api-types';

/** Membership tiers, passes and prices: the catalog, the gamer's own, buying and cancelling; the desk managers edit them. */
export const plansService = {
  paths: {
    tiers: '/membership-plans',
    passes: '/subscription-plans',
    myMemberships: '/memberships/me',
    mySubscriptions: '/subscriptions/me',
  },
  /** Paid from the wallet. The idempotency key makes a double tap buy once. */
  buy: (kind: 'membership' | 'subscription', planId: string, idempotencyKey: string) =>
    api('POST', `/${kind}-plans/${planId}/purchase`, { idempotencyKey }).then(() => true),
  /** Ends the tier at once, without a refund. */
  cancelMembership: () => api('POST', '/memberships/me/cancel').then(() => true),

  // Desk (managers)
  /** Creates the tier, or saves it when `id` is given. */
  saveTier: (id: string | null | undefined, body: MembershipPlanInput) =>
    api<MembershipPlan>(id ? 'PATCH' : 'POST', id ? `/membership-plans/${id}` : '/membership-plans', body),
  deleteTier: (id: string) => api('DELETE', `/membership-plans/${id}`).then(() => true),
  /** Creates the pass, or saves it when `id` is given. */
  savePass: (id: string | null | undefined, body: Partial<SubscriptionPlanInput>) =>
    api<SubscriptionPlan>(id ? 'PATCH' : 'POST', id ? `/subscription-plans/${id}` : '/subscription-plans', body),
  deletePass: (id: string) => api('DELETE', `/subscription-plans/${id}`).then(() => true),
  /** The prices per hour, the same at every branch. */
  savePricing: (body: Pick<Pricing, 'paygRate' | 'bookingRate'>) => api<Pricing>('PUT', '/pricing', body),
};
