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

/**
 * The platform's money is coins: whole numbers, the one unit of wallets,
 * prices and bills, so it works in any country. What a coin is worth is set
 * per deployment, here: 1000 coins = 1 DT (the cash the desk takes).
 */
export const COINS_PER_CURRENCY = 1000;
export const CURRENCY = 'DT';

const coinCount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Coins from the backend → "4,000 coins". Only formats what the server sent. */
export function formatCoins(coins: number | null | undefined): string {
  if (coins === null || coins === undefined || !Number.isFinite(coins)) return '—';
  return `${coinCount.format(coins)} ${Math.abs(coins) === 1 ? 'coin' : 'coins'}`;
}

/** "+10,000 coins" / "-1,500 coins" for ledger lines. */
export function formatSignedCoins(coins: number): string {
  return `${coins > 0 ? '+' : ''}${formatCoins(coins)}`;
}

/** A form value in coins ("4000", "4 000", "4,000") → whole coins, or null if it isn't one. */
export function parseCoins(text: string): number | null {
  const digits = text.trim().replace(/[\s,]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** Cash in the local currency ("10", "2.5", "2,5") → coins (2500), or null if it isn't a number. */
export function currencyToCoins(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(value) ? Math.round(value * COINS_PER_CURRENCY) : null;
}

/** What coins are worth in cash: 4500 → "4.500 DT". */
export function coinsInCurrency(coins: number): string {
  return `${(coins / COINS_PER_CURRENCY).toFixed(3)} ${CURRENCY}`;
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
