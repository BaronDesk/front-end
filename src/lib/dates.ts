/** `yyyy-mm-dd` of `now` in local time, for a date input. */
export function localDateInput(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The `from` / `to` query of GET /api/v1/reservations for `days` local days
 * starting on `date` (yyyy-mm-dd): bookings that overlap that time.
 */
export function dayRange(date: string, days: number): { from: string; to: string } {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + days);
  return { from: start.toISOString(), to: end.toISOString() };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "14/10/2026" for an ISO time (local day). */
export function dayDate(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "14/10/2026 14:00" for an ISO time (local). */
export function dayDateTime(iso: string): string {
  const d = new Date(iso);
  return `${dayDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "14/10/2026" for a yyyy-mm-dd value (a date input's). */
export function dayFromValue(value: string): string {
  return value.split('-').reverse().join('/');
}
