import { describe, expect, it } from 'vitest';

import { appendReading, summarize } from './telemetry';

const row = (recordedAt: string, metrics: Record<string, number>) => ({ recordedAt, metrics });

describe('telemetry history', () => {
  it('gives min, average and max per metric, over the rows that have it', () => {
    const summary = summarize([
      row('2026-10-01T10:00:00Z', { 'cpu.load_percent': 10, 'cpu.temperature_c': 50 }),
      row('2026-10-01T10:01:00Z', { 'cpu.load_percent': 30 }),
      row('2026-10-01T10:02:00Z', { 'cpu.load_percent': 50, 'cpu.temperature_c': 70 }),
    ]);
    expect(summary.get('cpu.load_percent')).toEqual({ min: 10, avg: 30, max: 50, samples: 3 });
    expect(summary.get('cpu.temperature_c')).toEqual({ min: 50, avg: 60, max: 70, samples: 2 });
    expect(summary.has('gpu.0.load_percent')).toBe(false);
  });

  it('adds a live reading at most once a minute, and drops rows past the cutoff', () => {
    const rows = [row('2026-10-01T09:00:00Z', { a: 1 }), row('2026-10-01T10:00:00Z', { a: 2 })];
    const cutoff = Date.parse('2026-10-01T09:30:00Z');

    const tooSoon = appendReading(rows, row('2026-10-01T10:00:30Z', { a: 3 }), cutoff);
    expect(tooSoon.map((r) => r.metrics.a)).toEqual([2]);

    const later = appendReading(rows, row('2026-10-01T10:01:00Z', { a: 3 }), cutoff);
    expect(later.map((r) => r.metrics.a)).toEqual([2, 3]);

    expect(appendReading([], row('2026-10-01T10:01:00Z', { a: 3 }), cutoff)).toHaveLength(1);
  });
});
