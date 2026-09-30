import { api, ApiError } from '../api/http';
import type { CheckIn, Reservation } from '../api/types';
import { formatClock, formatDateTime } from '../shared/format';

/** The server's check-in refusals, in words a gamer understands. */
const PIN_REFUSALS: Record<string, string> = {
  RESERVATION_EXPIRED: 'This booking is over: nobody logged in within 30 minutes of its start.',
  STATION_OFFLINE: 'The PC is switched off or offline right now. Try again in a moment or ask the desk.',
  SESSION_ALREADY_STARTED: 'Your session on this PC is already running.',
  PRICING_NOT_SET: 'Play is not open yet at this branch. Ask the desk.',
  INSUFFICIENT_FUNDS: 'Your balance is too low to start playing. Top up at the desk, then try again.',
};

/**
 * A new PIN for the gamer's own booking (every booking already comes with
 * one): the previous one stops working, so a PIN burned by wrong tries is
 * never a dead end.
 */
export function requestPin(r: Reservation): Promise<CheckIn> {
  return api<CheckIn>('POST', `/reservations/${r.id}/check-in`).catch((err: unknown) => {
    const text = err instanceof ApiError && err.code ? PIN_REFUSALS[err.code] : undefined;
    throw text ? new Error(text) : err;
  });
}

/** The PIN to type on the station's lock screen, and when it works. */
export function PinBox({ pin, station, validFrom, validUntil }: { pin: string; station: string; validFrom: string; validUntil: string | null }) {
  const started = Date.parse(validFrom) <= Date.now();
  return (
    <div className="msg">
      <b>Your PIN for {station}:</b> <span className="pin">{pin}</span>
      <div className="muted">
        Type it on that PC&apos;s lock screen {started ? 'now' : `from ${formatDateTime(validFrom)}`}
        {validUntil ? `, until ${formatClock(validUntil)} (after that the booking is lost)` : ''}.
      </div>
    </div>
  );
}
