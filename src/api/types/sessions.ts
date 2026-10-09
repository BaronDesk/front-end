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
  rateCoinsPerHour: number;
  playedSeconds: number;
  costSoFarCoins: number;
  balance: number;
  /** What the wallet holds once this session is paid. */
  balanceAfterCoins: number;
}

/** Prisma SessionStatus. PENDING = waiting for the PIN on the station; PAUSED = locked mid-session. */
export type SessionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

/** Session.billingBreakdown once settled. Amounts are coins. */
export interface BillingBreakdown {
  /** The bill. */
  totalCoins: number;
  /** What the wallet paid of it: less than the bill when the wallet ran dry. */
  chargedCoins?: number;
  /** The unpaid rest, left for the desk to collect. */
  shortfallCoins?: number;
  /** The wallet charge failed outright; the desk reconciles. */
  debitFailed?: boolean;
  meteredSeconds: number;
  rateCoinsPerHour: number;
  appliedMembershipId: string | null;
  [key: string]: unknown;
}

/** GET /sessions/:id, POST /sessions (session-billing/util/public-session.ts). */
export interface Session {
  id: string;
  reservationId: string;
  appliedMembershipId: string | null;
  status: SessionStatus;
  /** Coins per hour (billed by the second), the member discount already applied. */
  rateCoinsPerHour: number | null;
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
  /** Coins, while the session is open; null once it is closed (see billingBreakdown). */
  costSoFarCoins: number | null;
}

/** POST /sessions answer: the session plus the one-time PIN the gamer types on the lock screen. */
export interface StartedSession extends Session {
  pin: string;
}
