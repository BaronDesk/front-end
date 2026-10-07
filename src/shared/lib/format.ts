import { useEffect, useState } from 'react';

/** 14:05:09 */
export function formatClock(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}

/** 25/09 14:05 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

/** "1 h 05 min", "25 min", "40 s" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** "3 min ago" */
export function formatAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const seconds = (now - Date.parse(iso)) / 1000;
  return seconds < 5 ? 'just now' : `${formatDuration(seconds)} ago`;
}

/** Both branches are in Tunisia: dinars, 3 decimals (millimes). */
export const CURRENCY = 'DT';

/**
 * A dinar amount → "12.500 DT". Accepts the backend's Decimal columns too
 * (plan prices come as strings like "15"). Only formats; never computes money.
 */
export function formatMoney(amount: number | string | null | undefined): string {
  const value = amount === null || amount === undefined || amount === '' ? NaN : Number(amount);
  return Number.isFinite(value) ? `${value.toFixed(3)} ${CURRENCY}` : '—';
}

/** 1 dinar = 1000 millimes: the backend stores every money amount as integer millimes (prisma/seed.ts). */
const MILLIMES_PER_DINAR = 1000;

/**
 * Integer millimes from the backend → "4.500 DT". Only formats what the
 * server sent.
 */
export function formatMillimes(millimes: number | null | undefined): string {
  return millimes === null || millimes === undefined ? '—' : `${(millimes / MILLIMES_PER_DINAR).toFixed(3)} ${CURRENCY}`;
}

/** "+10.000 DT" / "-1.500 DT" for backend ledger lines (millimes). */
export function formatSignedMillimes(millimes: number): string {
  return `${millimes > 0 ? '+' : ''}${formatMillimes(millimes)}`;
}

/** A form value in dinars ("4.5") → integer millimes (4500), or null if it isn't a number. */
export function dinarsToMillimes(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(value) ? Math.round(value * MILLIMES_PER_DINAR) : null;
}

/** Integer millimes → a form value in dinars ("4.500"). */
export function millimesToDinars(millimes: number): string {
  return (millimes / MILLIMES_PER_DINAR).toFixed(3);
}

/** "+10.000 DT" / "-3.000 DT" for ledger lines. */
export function formatSignedMoney(amount: number): string {
  return `${amount > 0 ? '+' : ''}${formatMoney(amount)}`;
}

/** Seconds since `iso`. For display of elapsed time only; never for money. */
export function secondsSince(iso: string, now = Date.now()): number {
  return Math.max(0, (now - Date.parse(iso)) / 1000);
}

/** Re-render every `ms` so elapsed times move. Returns the current time. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
