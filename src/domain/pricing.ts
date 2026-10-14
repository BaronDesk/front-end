import type { Membership, Pricing, Reservation, Subscription } from '../core/api-types';
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

type Plans = Pick<Parameters<typeof bookingPrice>[0], 'pricing' | 'memberships' | 'subscriptions'>;

/**
 * Coins the gamer's bookings ahead already hold, as the server counts them:
 * each one not started yet (CONFIRMED) at its price, from now if its start
 * has passed. A new booking must fit in the balance left.
 */
export function committedCoins(bookings: Reservation[], plans: Plans, now = new Date()): number {
  return bookings
    .filter((r) => r.status === 'CONFIRMED' && Date.parse(r.endTime) > now.getTime())
    .reduce((sum, r) => {
      const start = new Date(Math.max(Date.parse(r.startTime), now.getTime()));
      const minutes = (Date.parse(r.endTime) - Date.parse(r.startTime)) / 60_000;
      return sum + bookingPrice({ ...plans, isNow: r.isWalkIn ?? false, start, minutes }).coins;
    }, 0);
}

/** The longest Play now the server takes. */
export const MAX_PLAY_MINUTES = 24 * 60;

export interface PlayNowLength {
  minutes: number;
  /** What stops it: the coins left, a booking (the PC's or the gamer's own, starting at `until`), or the longest allowed. */
  limit: 'balance' | 'booked' | 'max';
  until: Date;
}

/**
 * How long Play now can run on a seat until the coins run out: the coins
 * left at the seat's rate, cut at the seat's next booking, the gamer's own
 * next booking and the longest allowed. Free play (rate 0) is only cut by
 * the bookings and the longest allowed. 0 minutes: nothing can start now.
 */
export function playNowLength(input: {
  now: Date;
  coinsPerHour: number;
  coinsLeft: number;
  seatBookings: { startTime: string; endTime: string }[];
  myBookings: Reservation[];
}): PlayNowLength {
  const t = input.now.getTime();
  const mine = input.myBookings.filter((r) => r.status === 'CONFIRMED' || r.status === 'PENDING' || r.status === 'ACTIVE');
  const nextStart = Math.min(...[...input.seatBookings, ...mine].filter((b) => Date.parse(b.endTime) > t).map((b) => Date.parse(b.startTime)), Infinity);
  const freeMinutes = Math.max(Math.floor((nextStart - t) / 60_000), 0);
  const coinMinutes = input.coinsPerHour > 0 ? Math.max(Math.floor((input.coinsLeft * 60) / input.coinsPerHour), 0) : Infinity;
  const minutes = Math.min(freeMinutes, coinMinutes, MAX_PLAY_MINUTES);
  const limit = freeMinutes <= coinMinutes && freeMinutes <= MAX_PLAY_MINUTES ? 'booked' : coinMinutes <= MAX_PLAY_MINUTES ? 'balance' : 'max';
  return { minutes, limit, until: new Date(limit === 'booked' ? nextStart : t + minutes * 60_000) };
}
