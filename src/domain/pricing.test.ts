import { describe, expect, it } from 'vitest';

import type { Membership, Subscription } from '../core/api-types';
import { bookingPrice, inWindow } from './pricing';

const pricing = { paygRate: 4000, bookingRate: 5000 };
// Wed 30 Sep 2026, on this device's clock
const wed = (hhmm: string) => new Date(`2026-09-30T${hhmm}:00`);

const tier = (percent: string, status: Membership['status'] = 'ACTIVE') => ({ status, discountPercentSnapshot: percent }) as Membership;
const pass = (windows: NonNullable<Subscription['benefitsSnapshot']['windows']>) => ({ status: 'ACTIVE', benefitsSnapshot: { windows } }) as Subscription;
const nightOwl = pass([{ daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '06:00', discountPercent: 100 }]);

describe('booking price', () => {
  it('charges the Play now or booking rate for the length, rounded like the server', () => {
    expect(bookingPrice({ pricing, isNow: true, start: wed('14:00'), minutes: 60, memberships: [], subscriptions: [] })).toEqual({ coins: 4000, coinsPerHour: 4000, discountPercent: 0 });
    expect(bookingPrice({ pricing, isNow: false, start: wed('14:00'), minutes: 90, memberships: [], subscriptions: [] }).coins).toBe(7500);
    expect(bookingPrice({ pricing, isNow: true, start: wed('14:00'), minutes: 7, memberships: [], subscriptions: [] }).coins).toBe(467);
  });

  it("takes the better of the tier's discount and a pass window open at the start, never both", () => {
    const at = (hhmm: string) => bookingPrice({ pricing, isNow: true, start: wed(hhmm), minutes: 60, memberships: [tier('20')], subscriptions: [nightOwl] });
    expect(at('14:00')).toMatchObject({ coins: 3200, discountPercent: 20 });
    expect(at('03:00')).toMatchObject({ coins: 0, discountPercent: 100 });
  });

  it('ignores a tier or pass that is not active', () => {
    expect(bookingPrice({ pricing, isNow: true, start: wed('03:00'), minutes: 60, memberships: [tier('20', 'EXPIRED')], subscriptions: [{ ...nightOwl, status: 'EXPIRED' }] }).coins).toBe(4000);
  });

  it('reads pass windows like the server: end exclusive, start == end all day, past midnight belongs to the day it starts', () => {
    const w = (daysOfWeek: number[], startTime: string, endTime: string) => ({ daysOfWeek, startTime, endTime, discountPercent: 50 });
    expect(inWindow(w([3], '10:00', '14:00'), wed('13:59'))).toBe(true);
    expect(inWindow(w([3], '10:00', '14:00'), wed('14:00'))).toBe(false);
    expect(inWindow(w([3], '00:00', '00:00'), wed('23:30'))).toBe(true);
    expect(inWindow(w([2], '22:00', '02:00'), wed('01:00'))).toBe(true);
    expect(inWindow(w([3], '22:00', '02:00'), wed('01:00'))).toBe(false);
  });
});
