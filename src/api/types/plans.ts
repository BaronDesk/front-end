/** Membership tiers and passes (prices are Decimal strings, in dinars). */

/** GET/POST/PATCH /membership-plans. price and discountPercent are Decimals (strings on the wire). */
export interface MembershipPlan {
  id: string;
  name: string;
  /** Dinars, e.g. "15". */
  price: string;
  durationDays: number;
  discountPercent: string;
  /** How many days ahead a member may book. */
  bookingAdvanceDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipPlanInput {
  name: string;
  price: number;
  durationDays: number;
  discountPercent: number;
  bookingAdvanceDays?: number;
}

/**
 * A pass's benefits. The create schema takes time windows; the seed also
 * stores other shapes (free_hours, unlimited_free_play), so anything is shown.
 */
export interface SubscriptionBenefits {
  windows?: { daysOfWeek: number[]; startTime: string; endTime: string; discountPercent: number }[];
  [key: string]: unknown;
}

/** GET/POST/PATCH /subscription-plans. */
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  durationDays: number;
  benefits: SubscriptionBenefits;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanInput {
  name: string;
  price: number;
  durationDays: number;
  benefits: { windows: NonNullable<SubscriptionBenefits['windows']> };
}

export type PlanStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED' | 'PENDING';

/** GET /memberships/me item, and POST /membership-plans/:id/purchase. */
export interface Membership {
  id: string;
  gamerProfileId: string;
  membershipPlanId: string;
  discountPercentSnapshot: string;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  membershipPlan?: MembershipPlan;
}

/** GET /subscriptions/me item, and POST /subscription-plans/:id/purchase. */
export interface Subscription {
  id: string;
  gamerProfileId: string;
  subscriptionPlanId: string;
  benefitsSnapshot: SubscriptionBenefits;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  subscriptionPlan?: SubscriptionPlan;
}
