import { describe, expect, it } from 'vitest';

import type { Membership, Reservation, Subscription } from '../core/api-types';
import { bookingPrice, committedCoins, inWindow, playNowLength } from './pricing';

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

describe('Play now until the coins run out', () => {
  const now = wed('14:00');
  const at = (hhmm: string) => wed(hhmm).toISOString();
  const mine = (over: Partial<Reservation>) => ({ id: 'r', status: 'CONFIRMED', startTime: at('20:00'), endTime: at('21:00'), ...over }) as Reservation;

  it('plays as long as the coins left cover at the rate, rounded down to the minute', () => {
    expect(playNowLength({ now, coinsPerHour: 4000, coinsLeft: 10_000, seatBookings: [], myBookings: [] })).toMatchObject({ minutes: 150, limit: 'balance' });
    expect(playNowLength({ now, coinsPerHour: 3200, coinsLeft: 1000, seatBookings: [], myBookings: [] }).minutes).toBe(18);
  });

  it("stops at the PC's next booking or the gamer's own, and never past 24 h", () => {
    const seat = [{ startTime: at('16:00'), endTime: at('17:00') }];
    expect(playNowLength({ now, coinsPerHour: 4000, coinsLeft: 100_000, seatBookings: seat, myBookings: [] })).toMatchObject({ minutes: 120, limit: 'booked', until: wed('16:00') });
    // part of a minute left: it plays the whole minutes, and says the booking's own time
    expect(playNowLength({ now: new Date(wed('14:00').getTime() + 30_000), coinsPerHour: 4000, coinsLeft: 100_000, seatBookings: seat, myBookings: [] })).toMatchObject({ minutes: 119, until: wed('16:00') });
    expect(playNowLength({ now, coinsPerHour: 4000, coinsLeft: 100_000, seatBookings: [], myBookings: [mine({ startTime: at('15:00') })] }).minutes).toBe(60);
    expect(playNowLength({ now, coinsPerHour: 0, coinsLeft: 0, seatBookings: [], myBookings: [] })).toMatchObject({ minutes: 24 * 60, limit: 'max' });
  });

  it('starts nothing while one of the gamer\'s bookings is on, or with no coins', () => {
    expect(playNowLength({ now, coinsPerHour: 4000, coinsLeft: 100_000, seatBookings: [], myBookings: [mine({ status: 'ACTIVE', startTime: at('13:00'), endTime: at('15:00') })] })).toMatchObject({ minutes: 0, limit: 'booked' });
    expect(playNowLength({ now, coinsPerHour: 4000, coinsLeft: 0, seatBookings: [], myBookings: [] })).toMatchObject({ minutes: 0, limit: 'balance' });
  });

  it('counts the bookings ahead not started yet, at their own rate', () => {
    const plans = { pricing, memberships: [], subscriptions: [] };
    const list = [mine({}), mine({ isWalkIn: true, startTime: at('13:30'), endTime: at('14:30') }), mine({ status: 'COMPLETED' })];
    // 20:00–21:00 booked: 5000; a walk-in from 13:30, its PIN unused: 4000 for its full hour
    expect(committedCoins(list, plans, now)).toBe(9000);
  });
});
