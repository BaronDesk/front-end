import { describe, expect, it } from 'vitest';

import type { BranchStation } from '../core/api-types';
import { isTaken, panelHeight, roomsOf, seatLayout, seatOrder } from './seats';

describe('seatLayout', () => {
  it('fills the room as drawn: 28 seats in 6 rows, the first 2 rows one seat short on the right', () => {
    const seats = seatLayout(28);
    expect(seats).toHaveLength(28);
    expect(seats.slice(0, 4).map((s) => s.x)).toEqual([13, 48, 229, 265]);
    expect(seats.slice(8, 13).map((s) => s.x)).toEqual([13, 48, 195, 229, 265]);
    expect(seats[27]).toEqual({ x: 265, y: 53 + 5 * 30 });
    expect(panelHeight(28)).toBe(241);
  });

  it('adds rows for more seats and leaves the last row short for fewer', () => {
    expect(seatLayout(30).slice(28).map((s) => s.y)).toEqual([233, 233]);
    expect(seatLayout(5).map((s) => s.y)).toEqual([53, 53, 53, 53, 83]);
    expect(panelHeight(5)).toBe(83 + 24 + 14);
  });
});

describe('seatOrder', () => {
  it('numbers the room like the app: by name, then serial number, unnamed stations last', () => {
    const list = [
      { name: 'PC-02', serialNumber: 'B' },
      { name: null, serialNumber: 'A' },
      { name: 'PC-01', serialNumber: 'Z' },
      { name: 'PC-01', serialNumber: 'C' },
    ];
    expect(seatOrder(list).map((s) => s.serialNumber)).toEqual(['C', 'Z', 'B', 'A']);
  });
});

describe('roomsOf', () => {
  it('makes one room per branch, by branch name, each in seat order', () => {
    const st = (branchId: string, name: string) => ({ branchId, name, serialNumber: name });
    const rooms = roomsOf([st('b2', 'PC-02'), st('b1', 'PC-09'), st('b2', 'PC-01')], (id) => (id === 'b1' ? 'Lac 2' : 'El Manar'));
    expect(rooms.map((r) => [r.name, r.stations.map((s) => s.name)])).toEqual([
      ['El Manar', ['PC-01', 'PC-02']],
      ['Lac 2', ['PC-09']],
    ]);
  });
});

describe('isTaken', () => {
  const station = (bookings: [string, string][], extra: Partial<BranchStation> = {}): BranchStation => ({
    id: 's', name: 'PC', serialNumber: 'SN', online: true, busyNow: false, busyUntil: null,
    bookings: bookings.map(([startTime, endTime]) => ({ startTime, endTime })),
    ...extra,
  });
  const at = (h: number) => new Date(`2026-10-14T${String(h).padStart(2, '0')}:00:00Z`);

  it('is taken when a booking overlaps the slot, not when it only touches it', () => {
    const s = station([['2026-10-14T10:00:00Z', '2026-10-14T12:00:00Z']]);
    expect(isTaken(s, at(11), at(13), false)).toBe(true);
    expect(isTaken(s, at(12), at(13), false)).toBe(false);
    expect(isTaken(s, at(8), at(10), false)).toBe(false);
  });

  it('playing now also needs the PC on and free', () => {
    expect(isTaken(station([], { online: false }), at(10), at(11), true)).toBe(true);
    expect(isTaken(station([], { busyNow: true }), at(10), at(11), true)).toBe(true);
    expect(isTaken(station([], { online: false }), at(10), at(11), false)).toBe(false);
  });
});
