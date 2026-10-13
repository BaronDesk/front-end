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

export interface KnownStation {
  id: string;
  label: string;
}

/**
 * Stations the gamer can book: the one from the desk's booking link, plus
 * every station they booked before. The backend doesn't let gamers list
 * stations, so there is no other source.
 */
export function knownStations(list: Reservation[] | undefined, fromLink: KnownStation | null): KnownStation[] {
  const byId = new Map<string, KnownStation>();
  if (fromLink) byId.set(fromLink.id, fromLink);
  for (const r of list ?? []) {
    if (!byId.has(r.machineId)) {
      byId.set(r.machineId, { id: r.machineId, label: r.machine ? `${stationOf(r)} (${r.machine.serialNumber})` : stationOf(r) });
    }
  }
  return [...byId.values()];
}

/** "2 Hours", "1 Hour 30 Min", "45 Min" */
export function bookingLengthText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h ? `${h} ${h === 1 ? 'Hour' : 'Hours'}` : '';
  return [hours, m ? `${m} Min` : ''].filter(Boolean).join(' ');
}

/** The start times a day offers (yyyy-mm-dd): every half hour, from the next one when it is today. */
export function bookableTimes(day: string, now = new Date()): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = day === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const times: string[] = [];
  for (let t = 0; t < 24 * 60; t += 30) {
    if (today && t <= now.getHours() * 60 + now.getMinutes()) continue;
    times.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return times;
}
