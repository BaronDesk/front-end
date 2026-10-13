import { api } from '../core/http/client';
import type { CheckIn, ExtendOptions, Reservation, WalkIn } from '../core/api-types';
import { explainRefusal } from '../lib/errors';

/** The server's booking refusals, in words a gamer understands. */
const BOOKING_REFUSALS: Record<string, string> = {
  MACHINE_UNAVAILABLE: 'This PC is not available (to play now it must be switched on). Pick another one or ask the desk.',
  RESERVATION_SLOT_TAKEN: 'Someone already booked this PC for that time. Pick another time or PC.',
  GAMER_ALREADY_BOOKED: 'You already have a booking at that time: one PC at a time.',
  BOOKING_TOO_FAR_AHEAD: 'That is too far ahead for your plan. A higher membership lets you book further ahead.',
  INSUFFICIENT_FUNDS: 'Your balance does not cover this booking (your other bookings count too). Top up at the desk, or book less time.',
  PRICING_NOT_SET: 'Play is not open yet. Ask the desk.',
};

/** The server's check-in refusals. */
const PIN_REFUSALS: Record<string, string> = {
  RESERVATION_EXPIRED: 'This booking is over: nobody logged in within 30 minutes of its start.',
  STATION_OFFLINE: 'The PC is switched off or offline right now. Try again in a moment or ask the desk.',
  SESSION_ALREADY_STARTED: 'Your session on this PC is already running.',
  PRICING_NOT_SET: 'Play is not open yet at this branch. Ask the desk.',
  INSUFFICIENT_FUNDS: 'Your balance is too low to start playing. Top up at the desk, then try again.',
};

/** The server's refusals to extend a running booking. */
const EXTEND_REFUSALS: Record<string, string> = {
  RESERVATION_SLOT_TAKEN: 'Someone booked this PC right after you: extending is not possible.',
  INSUFFICIENT_FUNDS: 'Your balance does not cover the extra time. Top up at the desk.',
  GAMER_ALREADY_BOOKED: 'You have another booking at that time.',
  SESSION_NOT_RUNNING: 'Your session is no longer running.',
};

const explain = (refusals: Record<string, string>) => (err: unknown) => explainRefusal(err, refusals);

/**
 * The gamer's bookings. Refusals come back as Errors in words people
 * understand (an adapter over the server's codes).
 */
export const reservationsService = {
  paths: {
    mine: '/reservations',
    extendOptions: (reservationId: string) => `/reservations/${reservationId}/extend-options`,
    /** The desk's view: the branch's bookings in a time range. */
    staff: (params: URLSearchParams) => `/api/v1/reservations?${params}`,
  },
  /** A booking from `start` to `end`; it comes with its PIN. */
  book: (machineId: string, start: Date, end: Date) =>
    api<WalkIn>('POST', '/reservations', { machineId, startTime: start.toISOString(), endTime: end.toISOString() }).catch(explain(BOOKING_REFUSALS)),
  /** Play now (walk-in rate): the PC is yours at once. */
  playNow: (machineId: string, durationMinutes: number) =>
    api<WalkIn>('POST', '/reservations/walk-in', { machineId, durationMinutes }).catch(explain(BOOKING_REFUSALS)),
  cancel: (reservationId: string) => api('DELETE', `/reservations/${reservationId}`).then(() => true),
  /**
   * A new PIN for the gamer's own booking (every booking already comes with
   * one): the previous one stops working, so a PIN burned by wrong tries is
   * never a dead end.
   */
  newPin: (r: Pick<Reservation, 'id'>) => api<CheckIn>('POST', `/reservations/${r.id}/check-in`).catch(explain(PIN_REFUSALS)),
  /** The desk cancels a gamer's booking. */
  cancelAsStaff: (reservationId: string) => api('DELETE', `/api/v1/reservations/${reservationId}`),
  extend: (reservationId: string, minutes: number) =>
    api<{ endsAt: string }>('POST', `/reservations/${reservationId}/extend`, { minutes }).catch(explain(EXTEND_REFUSALS)),
};

export type { ExtendOptions };
