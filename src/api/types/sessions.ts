/** Play sessions and their bills. */

import type { StationRef } from './stations';

/** GET /sessions/me/current: the gamer's own session now (null when not playing). */
export interface CurrentSession {
  sessionId: string;
  reservationId: string;
  status: SessionStatus;
  /** 'runout' = locked for lack of money, 'offline' = the PC dropped off. */
  lockReason: string | null;
  station: StationRef;
  startedAt: string;
  endsAt: string;
  rateCentsPerMinute: number;
  playedSeconds: number;
  costSoFarCents: number;
  balance: number;
  /** What the wallet holds once this session is paid. */
  balanceAfterCents: number;
}

/** Prisma SessionStatus. PENDING = waiting for the PIN on the station; PAUSED = locked mid-session. */
export type SessionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

/** Session.billingBreakdown once settled. Amounts are millimes despite the "Cents" names. */
export interface BillingBreakdown {
  /** The bill. */
  totalCents: number;
  /** What the wallet paid of it: less than the bill when the wallet ran dry. */
  chargedCents?: number;
  /** The unpaid rest, left for the desk to collect. */
  shortfallCents?: number;
  /** The wallet charge failed outright; the desk reconciles. */
  debitFailed?: boolean;
  meteredSeconds: number;
  rateCentsPerMinute: number;
  appliedMembershipId: string | null;
  [key: string]: unknown;
}

/** GET /sessions/:id, POST /sessions (session-billing/util/public-session.ts). */
export interface Session {
  id: string;
  reservationId: string;
  appliedMembershipId: string | null;
  status: SessionStatus;
  /** Millimes per minute, the member discount already applied. */
  rateCentsPerMinute: number | null;
  meteredSeconds: number;
  startTime: string | null;
  endTime: string | null;
  lockedAt: string | null;
  settledAt: string | null;
  billingBreakdown: BillingBreakdown | null;
  createdAt: string;
}

/** GET /sessions (staff): sessions a gamer logged into, newest first, with station and gamer. */
export interface StaffSession extends Session {
  station: StationRef;
  gamerUsername: string;
  /** Millimes, while the session is open; null once it is closed (see billingBreakdown). */
  costSoFarCents: number | null;
}

/** POST /sessions answer: the session plus the one-time PIN the gamer types on the lock screen. */
export interface StartedSession extends Session {
  pin: string;
}
