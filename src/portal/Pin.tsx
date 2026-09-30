import { api, ApiError } from '../api/http';
import type { CheckIn, Reservation } from '../api/types';
import { formatClock } from '../shared/format';

/** The server's check-in refusals, in words a gamer understands. */
const PIN_REFUSALS: Record<string, string> = {
  RESERVATION_NOT_STARTED: 'Too early: you can get your PIN 15 minutes before your booking.',
  STATION_OFFLINE: 'The PC is switched off or offline right now. Try again in a moment or ask the desk.',
  SESSION_ALREADY_STARTED: 'Your session on this PC is already running.',
  PRICING_NOT_SET: 'Play is not open yet at this branch. Ask the desk.',
};

/**
 * Gets the PIN for the gamer's own booking. Asking again gives a new PIN
 * (the previous one stops working), so a lost PIN is never a dead end.
 */
export function requestPin(r: Reservation): Promise<CheckIn> {
  return api<CheckIn>('POST', `/reservations/${r.id}/check-in`).catch((err: unknown) => {
    const text = err instanceof ApiError && err.code ? PIN_REFUSALS[err.code] : undefined;
    throw text ? new Error(text) : err;
  });
}

/** The PIN to type on the station's lock screen. */
export function PinBox({ checkIn, station }: { checkIn: CheckIn; station: string }) {
  return (
    <div className="msg">
      <b>Your PIN for {station}:</b> <span className="pin">{checkIn.pin}</span>
      <div className="muted">Type it on the PC&apos;s lock screen to start playing. It works until {formatClock(checkIn.pinExpiresAt)}.</div>
    </div>
  );
}
