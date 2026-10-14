import type { Reservation, ReservationStatus } from '../core/api-types';

export const RESERVATION_TEXT: Record<ReservationStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Booked',
  ACTIVE: 'Playing',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'Missed',
};

/** A booked one shows as "now" on the home and session pages from this long before its start. */
const SOON_MS = 15 * 60_000;

/** A booking nobody logged into this long after its start becomes a no-show (the server's NO_SHOW_GRACE_MINUTES). */
export const NO_SHOW_MS = 30 * 60_000;

/**
 * The booking the gamer is on now: a running one (ACTIVE), else a booked one
 * whose time has come (or comes within 15 minutes) and isn't a no-show yet.
 */
export function currentBooking(list: Reservation[] | undefined, now = Date.now()): Reservation | undefined {
  if (!list) return undefined;
  return (
    list.find((r) => r.status === 'ACTIVE') ??
    list.find((r) => r.status === 'CONFIRMED' && Date.parse(r.startTime) - SOON_MS <= now && pinDeadline(r) > now)
  );
}

/** When the booking's PIN stops working: 30 min after the start (a no-show then), never past the end. */
export function pinDeadline(r: Reservation): number {
  return Math.min(Date.parse(r.startTime) + NO_SHOW_MS, Date.parse(r.endTime));
}

/** A booking whose PIN can still be used or replaced (the server checks the same). */
export function canCheckIn(r: Reservation, now = Date.now()): boolean {
  return r.status === 'CONFIRMED' && pinDeadline(r) > now;
}

/**
 * Nobody plays on it yet, so it can be cancelled: a booking ahead, or one
 * that started without a login, until its no-show deadline (the server
 * refuses once a session is in play).
 */
export function isCancellable(r: Reservation, now = Date.now()): boolean {
  return (r.status === 'PENDING' || r.status === 'CONFIRMED') && pinDeadline(r) > now;
}

export function stationOf(r: Reservation): string {
  return r.machine ? (r.machine.name ?? r.machine.serialNumber) : r.machineId.slice(0, 8);
}

/** "2 Hours", "1 Hour 30 Min", "45 Min" */
export function bookingLengthText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h ? `${h} ${h === 1 ? 'Hour' : 'Hours'}` : '';
  return [hours, m ? `${m} Min` : ''].filter(Boolean).join(' ');
}

/**
 * The start times a day offers (yyyy-mm-dd): every half hour, from the next
 * one when it is today (`past`: the hours gone by too, for the desk looking back).
 */
export function bookableTimes(day: string, now = new Date(), past = false): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = day === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const times: string[] = [];
  for (let t = 0; t < 24 * 60; t += 30) {
    if (today && !past && t <= now.getHours() * 60 + now.getMinutes()) continue;
    times.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return times;
}

/** The lengths a booking can have (minutes), as the app offers them. */
export const BOOKING_LENGTHS = [30, 60, 90, 120, 180];
/** Bookings are known 7 days ahead: today and the next 6. */
export const BOOKING_DAYS_AHEAD = 6;

/** The "Max" length of Play now: play until the coins run out (the minutes are worked out per seat, domain/pricing.ts). */
export const UNTIL_BALANCE = 0;

/** A length on a pill: "30 min", "1.5 h", "Max". */
export function lengthShortText(minutes: number): string {
  if (minutes === UNTIL_BALANCE) return 'Max';
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

/** A time slot as the app's pickers choose it: a day, "now" or a start time, a length. */
export interface Slot {
  day: string;
  time: string;
  minutes: number;
}

/** The slot's start and end; "now" starts now. */
export function slotRange(slot: Slot, now = new Date()): { start: Date; end: Date; isNow: boolean } {
  const isNow = slot.time === 'now';
  const start = isNow ? now : new Date(`${slot.day}T${slot.time}:00`);
  return { start, end: new Date(start.getTime() + slot.minutes * 60_000), isNow };
}
