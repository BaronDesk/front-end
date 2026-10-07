import type { SubscriptionBenefits } from '../api/types';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WEEK_DAYS = DAY.map((label, value) => ({ value, label }));

function days(list: number[]): string {
  const sorted = [...list].sort();
  if (sorted.length === 7) return 'every day';
  if (sorted.join() === '1,2,3,4,5') return 'Mon–Fri';
  if (sorted.join() === '0,6') return 'weekends';
  return sorted.map((d) => DAY[d]).join(', ');
}

/**
 * A pass's benefits in words. The create schema stores time windows; the
 * seed also has other shapes (free_hours, unlimited_free_play), shown as best
 * we can, and anything unknown as its raw JSON.
 */
export function benefitsText(b: SubscriptionBenefits | null | undefined): string {
  if (!b) return '—';
  if (Array.isArray(b.windows) && b.windows.length) {
    return b.windows
      .map((w) => `${days(w.daysOfWeek)} ${w.startTime}–${w.endTime}: ${w.discountPercent >= 100 ? 'free' : `−${w.discountPercent} %`}`)
      .join('; ');
  }
  if (b.type === 'free_hours' && typeof b.hours === 'number') {
    return `${b.hours} free hours${typeof b.scope === 'string' ? ` (${b.scope})` : ''}`;
  }
  if (b.type === 'unlimited_free_play') {
    const w = b.window as { start?: string; end?: string } | undefined;
    return `Free play${w?.start && w?.end ? ` ${w.start}–${w.end}` : ''}`;
  }
  return JSON.stringify(b);
}

export type BenefitWindow = NonNullable<SubscriptionBenefits['windows']>[number];

/** The backend's cap on windows per pass. */
export const MAX_WINDOWS = 50;

/** One window as the pass form edits it: the discount stays text until saved. */
export interface WindowRow {
  days: number[];
  startTime: string;
  endTime: string;
  discountPercent: string;
}

/** A new window: every night, free. */
export const NEW_WINDOW: WindowRow = { days: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '06:00', discountPercent: '100' };

/** A pass's windows as form rows; [] when its benefits use another shape (seeded free_hours…). */
export function windowRows(b: SubscriptionBenefits | null | undefined): WindowRow[] {
  if (!b || !Array.isArray(b.windows)) return [];
  return b.windows.map((w) => ({
    days: [...w.daysOfWeek].sort((x, y) => x - y),
    startTime: w.startTime,
    endTime: w.endTime,
    discountPercent: String(w.discountPercent),
  }));
}

/** Form rows as the backend's windows; null while a row has no day ticked. */
export function rowsToWindows(rows: WindowRow[]): BenefitWindow[] | null {
  if (rows.some((r) => r.days.length === 0)) return null;
  return rows.map((r) => ({
    daysOfWeek: [...r.days].sort((x, y) => x - y),
    startTime: r.startTime,
    endTime: r.endTime,
    discountPercent: Number(r.discountPercent),
  }));
}

/** "10" → "−10 %" (Decimal strings from the backend). */
export function discountText(percent: string | number): string {
  const n = Number(percent);
  return Number.isFinite(n) && n > 0 ? `−${n} %` : 'no discount';
}
