import type { Membership, Pricing, Subscription } from '../core/api-types';
import type { BenefitWindow } from './plans';

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Whether `at` falls in a pass window, on this device's clock. The end is
 * exclusive; start == end is the whole day; a window that ends before it
 * starts runs past midnight and belongs to the day it starts on.
 */
export function inWindow(window: BenefitWindow, at: Date): boolean {
  const day = at.getDay();
  const minute = at.getHours() * 60 + at.getMinutes();
  const start = toMinutes(window.startTime);
  const end = toMinutes(window.endTime);
  const on = (d: number) => window.daysOfWeek.includes(d);
  if (start === end) return on(day);
  if (start < end) return on(day) && minute >= start && minute < end;
  if (minute >= start) return on(day);
  return minute < end && on((day + 6) % 7);
}

export interface BookingPrice {
  coins: number;
  coinsPerHour: number;
  /** The discount applied: the tier's or a pass window's, whichever is bigger (0 for none). */
  discountPercent: number;
}

/**
 * What a booking costs, by the server's rule: the Play now rate or the
 * booking rate, less the better of the tier's discount and a pass window open
 * when play starts (they don't stack), for the whole length. The server
 * checks the wallet against the same amount.
 */
export function bookingPrice(input: {
  pricing: Pick<Pricing, 'paygRate' | 'bookingRate'>;
  isNow: boolean;
  start: Date;
  minutes: number;
  memberships: Membership[];
  subscriptions: Subscription[];
}): BookingPrice {
  const tier = input.memberships.find((m) => m.status === 'ACTIVE');
  const tierPercent = tier ? Number(tier.discountPercentSnapshot) || 0 : 0;
  const passPercent = Math.max(
    0,
    ...input.subscriptions
      .filter((s) => s.status === 'ACTIVE')
      .flatMap((s) => s.benefitsSnapshot?.windows ?? [])
      .filter((w) => inWindow(w, input.start))
      .map((w) => w.discountPercent),
  );
  const discountPercent = Math.max(tierPercent, passPercent);
  const rate = input.isNow ? input.pricing.paygRate : input.pricing.bookingRate;
  const coinsPerHour = Math.max(Math.round(rate * (1 - discountPercent / 100)), 0);
  return { coins: Math.max(Math.round((coinsPerHour * input.minutes) / 60), 0), coinsPerHour, discountPercent };
}
