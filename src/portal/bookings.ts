import type { Reservation, ReservationStatus } from '../api/types';

export const RESERVATION_TEXT: Record<ReservationStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Booked',
  ACTIVE: 'Playing',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'Missed',
};

/** The gamer can get their PIN from 15 minutes before the booked time. */
const EARLY_MS = 15 * 60_000;

/**
 * The booking the gamer is on now: a running one (ACTIVE), else a booked one
 * whose time has come (or comes within 15 minutes).
 */
export function currentBooking(list: Reservation[] | undefined, now = Date.now()): Reservation | undefined {
  if (!list) return undefined;
  return (
    list.find((r) => r.status === 'ACTIVE') ??
    list.find((r) => canCheckIn(r, now))
  );
}

/** The gamer can get the PIN from 15 minutes before the booked time until it ends (the server checks the same). */
export function canCheckIn(r: Reservation, now = Date.now()): boolean {
  return r.status === 'CONFIRMED' && Date.parse(r.startTime) - EARLY_MS <= now && Date.parse(r.endTime) > now;
}

/** Still ahead, so it can be cancelled (the server refuses once it has started). */
export function isCancellable(r: Reservation, now = Date.now()): boolean {
  return (r.status === 'PENDING' || r.status === 'CONFIRMED') && Date.parse(r.startTime) > now;
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
