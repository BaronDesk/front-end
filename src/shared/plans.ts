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

/** "10" → "−10 %" (Decimal strings from the backend). */
export function discountText(percent: string | number): string {
  const n = Number(percent);
  return Number.isFinite(n) && n > 0 ? `−${n} %` : 'no discount';
}
