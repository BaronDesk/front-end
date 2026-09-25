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
