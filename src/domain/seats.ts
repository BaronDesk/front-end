import type { BranchStation } from '../core/api-types';

/** Seat columns on the Figma "Reserve" panel (px from its left): a block of 2, an aisle, a block of 3. */
const LEFT_BLOCK = [13, 48];
const RIGHT_BLOCK = [195, 229, 265];
/** The first seat row's top, and one row to the next (px). */
const FIRST_ROW = 53;
const ROW = 30;
/** As drawn, the first 2 rows have no seat at the aisle side of the right block. */
const SHORT_ROWS = 2;
export const SEAT = 24;

export interface Seat {
  x: number;
  y: number;
}

/**
 * Where `count` seats sit on the panel, in Figma px, numbered in reading order
 * (row by row, left block then right block). The design's room is 28 seats
 * in 6 rows; more seats add rows below, fewer leave the last rows short.
 */
export function seatLayout(count: number): Seat[] {
  const seats: Seat[] = [];
  for (let row = 0; seats.length < count; row++) {
    const right = row < SHORT_ROWS ? RIGHT_BLOCK.slice(1) : RIGHT_BLOCK;
    for (const x of [...LEFT_BLOCK, ...right]) {
      if (seats.length === count) break;
      seats.push({ x, y: FIRST_ROW + row * ROW });
    }
  }
  return seats;
}

/** The panel's height for `count` seats (241 px drawn for 6 rows), 14 px under the last row. */
export function panelHeight(count: number): number {
  const seats = seatLayout(count);
  const lastTop = seats.length ? seats[seats.length - 1].y : FIRST_ROW - ROW;
  return lastTop + SEAT + 14;
}

/**
 * The room's seat order: by name, then serial number, a station without a name
 * last (the backend's order for booking, so seat 3 on the desk is seat 3 in the app).
 */
export function seatOrder<T extends { name: string | null; serialNumber: string }>(stations: T[]): T[] {
  const key = (s: T) => s.name ?? '';
  return [...stations].sort((a, b) => {
    if (a.name === null || b.name === null) return a.name === b.name ? a.serialNumber.localeCompare(b.serialNumber) : a.name === null ? 1 : -1;
    return key(a).localeCompare(key(b)) || a.serialNumber.localeCompare(b.serialNumber);
  });
}

/** A branch's room: its stations in seat order. */
export interface Room<T> {
  branchId: string;
  name: string;
  stations: T[];
}

/** The stations grouped by branch, one room each (branches by name, stations in seat order). */
export function roomsOf<T extends { branchId?: string; name: string | null; serialNumber: string }>(stations: T[], branchName: (id: string) => string): Room<T>[] {
  const byBranch = new Map<string, T[]>();
  for (const s of stations) byBranch.set(s.branchId ?? '', [...(byBranch.get(s.branchId ?? '') ?? []), s]);
  return [...byBranch.entries()]
    .map(([branchId, members]) => ({ branchId, name: branchId ? branchName(branchId) : '—', stations: seatOrder(members) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether the station is taken for [start, end): a booking overlaps it, or (playing now) it is off or busy. */
export function isTaken(station: BranchStation, start: Date, end: Date, now: boolean): boolean {
  if (now && (!station.online || station.busyNow)) return true;
  return station.bookings.some((b) => Date.parse(b.startTime) < end.getTime() && Date.parse(b.endTime) > start.getTime());
}
