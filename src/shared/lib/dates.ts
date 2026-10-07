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
