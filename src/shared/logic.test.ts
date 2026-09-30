import { describe, expect, it } from 'vitest';

import type { Machine, Reservation } from '../api/types';
import { deriveBranches } from '../admin/branch/branches';
import { currentBooking, isCancellable, knownStations } from '../portal/bookings';
import { benefitsText, discountText } from './plans';
import { entryText } from './wallet';

const machine = (id: string, branchId: string, serialNumber: string): Machine => ({
  id,
  branchId,
  serialNumber,
  agentPublicKey: '',
  enrollmentStatus: 'ENROLLED',
  name: null,
  status: 'OFFLINE',
  lastSeen: null,
  createdAt: '2026-09-30T00:00:00Z',
});

describe('branches built from GET /machines', () => {
  it('labels a branch by its PCs serial prefix, else by a short id', () => {
    const branches = deriveBranches(
      [machine('m1', 'b-lac-0000', 'LAC-PC-01'), machine('m2', 'b-lac-0000', 'LAC-PC-02'), machine('m3', 'b-mix-0000', 'A-1'), machine('m4', 'b-mix-0000', 'B-1')],
      ['b-empty-000'],
    );
    expect(branches).toEqual([
      { id: 'b-empty-000', name: 'Branch b-empty-' },
      { id: 'b-mix-0000', name: 'Branch b-mix-00' },
      { id: 'b-lac-0000', name: 'LAC branch' },
    ]);
  });
});

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

describe('plan and ledger wording', () => {
  it('describes pass benefits of every shape the backend stores', () => {
    expect(benefitsText({ windows: [{ daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '06:00', discountPercent: 100 }] })).toBe(
      'every day 00:00–06:00: free',
    );
    expect(benefitsText({ windows: [{ daysOfWeek: [0, 6], startTime: '10:00', endTime: '14:00', discountPercent: 50 }] })).toBe(
      'weekends 10:00–14:00: −50 %',
    );
    expect(benefitsText({ type: 'free_hours', hours: 15, scope: 'weekend' })).toBe('15 free hours (weekend)');
    expect(benefitsText({ type: 'unlimited_free_play', window: { start: '00:00', end: '06:00' } })).toBe('Free play 00:00–06:00');
    expect(discountText('10')).toBe('−10 %');
    expect(discountText('0')).toBe('no discount');
  });

  it('names ledger lines: a PAYMENT with a session is play time', () => {
    expect(entryText({ type: 'PAYMENT', sessionId: 's1' })).toBe('Play time');
    expect(entryText({ type: 'PAYMENT', sessionId: null })).toBe('Plan purchase');
    expect(entryText({ type: 'CREDIT', sessionId: null })).toBe('Top-up');
  });
});
