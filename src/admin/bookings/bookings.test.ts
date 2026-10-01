import { describe, expect, it } from 'vitest';

import { dayRange, localDateInput } from './bookings';

describe('staff bookings: date range', () => {
  it('formats the local day for a date input', () => {
    expect(localDateInput(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('covers whole local days, across a month end', () => {
    const { from, to } = dayRange('2026-09-30', 2);
    expect(new Date(from).getTime()).toBe(new Date(2026, 8, 30).getTime());
    expect(new Date(to).getTime()).toBe(new Date(2026, 9, 2).getTime());
  });
});
