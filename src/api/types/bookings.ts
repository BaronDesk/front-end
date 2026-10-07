/** Bookings (reservations), PINs and walk-ins. */

import type { StationRef } from './stations';

/** GET /reservations/:id/extend-options. */
export interface ExtendOptions {
  reservationId: string;
  endsAt: string;
  options: { minutes: number; costCents: number; available: boolean; reason: 'SLOT_TAKEN' | 'INSUFFICIENT_FUNDS' | null }[];
}

/** GET /api/v1/reservations (staff): a booking with who booked it and on which station. */
export interface StaffReservation extends Reservation {
  gamerUsername: string;
  machine: StationRef;
}

/** Prisma ReservationStatus. A booking is CONFIRMED at once; ACTIVE while its session runs. */
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

/** GET /reservations (the gamer's own), POST /reservations, POST /reservations/walk-in. */
export interface Reservation {
  id: string;
  gamerProfileId: string;
  machineId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  machine?: StationRef;
  /** GET /reservations (own): the booking's PIN while unused. It works on that PC from validFrom (the start) until validUntil (the no-show deadline). */
  pin?: { pin: string; validFrom: string; validUntil: string | null } | null;
}

/** POST /reservations/:id/check-in: the PIN the gamer types on the station's lock screen. */
export interface CheckIn {
  sessionId: string;
  reservationId: string;
  pin: string;
  pinExpiresAt: string;
}

/** POST /reservations and /reservations/walk-in: the booking, with its PIN (null if it could not be issued yet). */
export interface WalkIn extends Reservation {
  checkIn: CheckIn | null;
}
