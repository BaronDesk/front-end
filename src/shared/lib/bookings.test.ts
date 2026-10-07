import { describe, expect, it } from 'vitest';

import type { Reservation } from '../../api/types';
import { currentBooking, isCancellable, knownStations } from './bookings';

const booking = (over: Partial<Reservation>): Reservation => ({
  id: 'r1',
  gamerProfileId: 'g1',
  machineId: 'm1',
  startTime: '2026-09-30T10:00:00Z',
  endTime: '2026-09-30T11:00:00Z',
  status: 'CONFIRMED',
  createdAt: '2026-09-29T00:00:00Z',
  updatedAt: '2026-09-29T00:00:00Z',
  ...over,
});

describe('portal bookings', () => {
  const at = (iso: string) => Date.parse(iso);

  it('the current booking is the running one, else one whose time has come', () => {
    const later = booking({ id: 'later', startTime: '2026-09-30T15:00:00Z', endTime: '2026-09-30T16:00:00Z' });
    const now = booking({ id: 'now' });
    expect(currentBooking([later, now], at('2026-09-30T09:50:00Z'))?.id).toBe('now'); // 10 min early is fine
    expect(currentBooking([later, now], at('2026-09-30T09:30:00Z'))).toBeUndefined();
    expect(currentBooking([now, booking({ id: 'run', status: 'ACTIVE' })], at('2026-09-30T08:00:00Z'))?.id).toBe('run');
  });

  it('only a booking that has not started can be cancelled', () => {
    expect(isCancellable(booking({}), at('2026-09-30T09:00:00Z'))).toBe(true);
    expect(isCancellable(booking({}), at('2026-09-30T10:15:00Z'))).toBe(true); // started, nobody logged in yet
    expect(isCancellable(booking({}), at('2026-09-30T10:30:00Z'))).toBe(false); // no-show deadline
    expect(isCancellable(booking({ status: 'CANCELLED' }), at('2026-09-30T09:00:00Z'))).toBe(false);
  });

  it('bookable stations: the one from the desk link, then the ones booked before', () => {
    const list = [booking({ machineId: 'm2', machine: { id: 'm2', name: 'PC-02', serialNumber: 'MNR-PC-02', branchId: 'b' } })];
    expect(knownStations(list, { id: 'm1', label: 'PC-01' })).toEqual([
      { id: 'm1', label: 'PC-01' },
      { id: 'm2', label: 'PC-02 (MNR-PC-02)' },
    ]);
  });
});
