import { describe, expect, it } from 'vitest';

import { benefitsText, discountText, NEW_WINDOW, rowsToWindows, windowRows } from './plans';

describe('plan wording and pass form rows', () => {
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

  it('turns a pass with several windows into form rows and back', () => {
    const windows = [
      { daysOfWeek: [5, 1, 3], startTime: '14:00', endTime: '18:00', discountPercent: 30 },
      { daysOfWeek: [6, 0], startTime: '22:00', endTime: '02:00', discountPercent: 100 },
    ];
    const rows = windowRows({ windows });
    expect(rows).toEqual([
      { days: [1, 3, 5], startTime: '14:00', endTime: '18:00', discountPercent: '30' },
      { days: [0, 6], startTime: '22:00', endTime: '02:00', discountPercent: '100' },
    ]);
    expect(rowsToWindows(rows)).toEqual([
      { daysOfWeek: [1, 3, 5], startTime: '14:00', endTime: '18:00', discountPercent: 30 },
      { daysOfWeek: [0, 6], startTime: '22:00', endTime: '02:00', discountPercent: 100 },
    ]);
  });

  it('pass form rows: other benefit shapes give no rows, a row without a day blocks saving', () => {
    expect(windowRows({ type: 'free_hours', hours: 15 })).toEqual([]);
    expect(windowRows(null)).toEqual([]);
    expect(rowsToWindows([])).toEqual([]);
    expect(rowsToWindows([{ ...NEW_WINDOW, days: [] }])).toBeNull();
  });
});
