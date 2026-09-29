/*
 * Shapes the frontend reads from the backend. Auth, user and station shapes
 * mirror back-end/src as it is today. Everything else still follows
 * Step 0 — Frozen Contracts and the Frontend brief §7/§8; the backend does
 * not serve those yet, so the mock layer (src/mocks) is the only producer.
 */

export type Role = 'GAMER' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

/** identity/util/public-user.ts */
export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  accountStatus: AccountStatus;
  /** null = HQ / global scope, or a gamer. */
  branchId: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

/** Body of every non-2xx response (common/filters/all-exceptions.filter.ts). */
export interface ApiErrorBody {
  error: string;
  code: string;
  issues?: unknown;
}

export interface Branch {
  id: string;
  name: string;
}

export interface BranchSummary {
  branchId: string;
  name: string;
  stationsTotal: number;
  stationsOnline: number;
  stationsInSession: number;
  openAlerts: number;
}

export type MachineStatus = 'ONLINE' | 'OFFLINE';

/** GET /api/v1/stations item (station/services/stations.service.ts toStation). */
export interface Station {
  id: string;
  serialNumber: string;
  /** Optional on the machine row: show serialNumber when null (stationLabel). */
  name: string | null;
  status: MachineStatus;
  lastSeen: string | null;
  /** null until the agent has reported since the server started. */
  locked: boolean | null;
  sessionId: string | null;
  /** The catalog's wire gameId, set only from the agent's state_report. */
  runningGameId: string | null;
  ip: string | null;
  /** Not in the real list yet (backend gap); the mock sends it. */
  branchId?: string;
}

/** Backend MachineEnrollmentStatus. */
export type MachineEnrollmentStatus = 'PENDING' | 'ENROLLED' | 'INACTIVE' | 'DEACTIVATED';

/** GET /api/v1/stations/:id */
export interface StationDetail extends Station {
  branchId: string;
  enrollmentStatus: MachineEnrollmentStatus;
  /** When the agent's unlock lease runs out, if it reported one. */
  leaseExpiresAt: string | null;
}

/**
 * Mock only: the backend has no enrollment admin endpoints yet, so the
 * "New stations" page still uses the draft shape and statuses.
 */
export type EnrollmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export interface EnrollmentStation {
  id: string;
  branchId: string;
  name: string;
  mac: string;
  ip: string;
  enrollmentStatus: EnrollmentStatus;
  online: boolean;
  lastSeenAt: string | null;
}

export interface StationAvailability {
  machineId: string;
  branchId: string;
  name: string;
  /** Free = online, not in a session, no reservation starting within 30 min. */
  free: boolean;
  nextReservationAt: string | null;
}

/** Metric names come from the agent's HardwareTelemetryMapper. */
export interface TelemetrySample {
  metric: string;
  value: number;
  sampledAt: string;
}

export interface Game {
  id: string;
  title: string;
  executablePath: string;
  genre: string;
  cover: string | null;
}

export type CommandType = 'UNLOCK' | 'LOCK' | 'SHUTDOWN' | 'LAUNCH_GAME' | 'END_SESSION' | 'POLICY_UPDATE';
export type CommandStatus = 'PENDING' | 'ACKED' | 'NACKED' | 'TIMEOUT';

export interface CommandLog {
  id: string;
  machineId: string;
  type: CommandType;
  payload: Record<string, unknown>;
  status: CommandStatus;
  code: string | null;
  reason: string | null;
  issuedBy: string;
  issuedAt: string;
  completedAt: string | null;
}

export type AlertCategory = 'hardware' | 'anti_theft' | 'security_violation';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKED' | 'RESOLVED';

export interface Alert {
  id: string;
  machineId: string;
  branchId: string;
  category: AlertCategory;
  type: string;
  severity: AlertSeverity;
  detail: string;
  status: AlertStatus;
  occurredAt: string;
}

export type TransactionType =
  | 'TOPUP'
  | 'SESSION_CHARGE'
  | 'BOOKING_FEE'
  | 'MEMBERSHIP'
  | 'SUBSCRIPTION'
  | 'REFUND'
  | 'REVERSAL';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  /** Positive = credit, negative = debit. */
  amount: number;
  balanceAfter: number;
  method: string | null;
  note: string | null;
  reversedById: string | null;
  createdAt: string;
}

export interface Wallet {
  userId: string;
  balance: number;
}

export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  discountPercent: number;
  durationDays: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  hoursIncluded: number;
  durationDays: number;
}

export interface Membership {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  hoursLeft: number;
  startsAt: string;
  endsAt: string;
}

export interface GamerProfile {
  userId: string;
  xp: number;
  level: number;
}

export type ReservationStatus = 'BOOKED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW';

export interface Reservation {
  id: string;
  userId: string;
  machineId: string;
  branchId: string;
  start: string;
  end: string;
  status: ReservationStatus;
  createdAt: string;
}

export type SessionStatus = 'ACTIVE' | 'WARNED' | 'ENDED';

export interface BillingBreakdown {
  minutes: number;
  ratePerHour: number;
  subtotal: number;
  discountPercent: number;
  discount: number;
  hoursFromPass: number;
  total: number;
}

export interface Session {
  id: string;
  userId: string;
  machineId: string;
  branchId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  billing: BillingBreakdown | null;
}

/** A session plus the server's live estimate, so a page has numbers before the first session_update. */
export interface SessionView extends Session {
  elapsedSeconds: number;
  estimatedCost: number;
  balance: number;
  runoutAt: string | null;
}

export interface Pricing {
  ratePerHour: number;
  bookingFee: number;
  lowBalanceMinutes: number;
}

// ---------- /dashboard-io events (brief §7) ----------

/** station/services/presence.service.ts StationStatusEvent. Keyed by serialNumber, not id. */
export interface StationStatusEvent {
  serialNumber: string;
  name: string | null;
  status: MachineStatus;
  lastSeen: string;
  ip: string | null;
  locked: boolean | null;
  sessionId: string | null;
  runningGameId: string | null;
  branchId: string;
}

export interface TelemetryUpdateEvent {
  machineId: string;
  branchId: string;
  samples: TelemetrySample[];
}

export type AlertEvent = Alert;

export interface SessionUpdateEvent {
  sessionId: string;
  machineId: string;
  branchId: string;
  userId: string;
  status: SessionStatus;
  startedAt: string;
  elapsedSeconds: number;
  estimatedCost: number;
  balance: number;
  runoutAt: string | null;
  billing: BillingBreakdown | null;
}

export interface CommandResultEvent {
  commandId: string;
  machineId: string;
  branchId: string;
  type: CommandType;
  status: Exclude<CommandStatus, 'PENDING'>;
  code: string | null;
  reason: string | null;
}

export interface DashboardEvents {
  station_status: StationStatusEvent;
  telemetry_update: TelemetryUpdateEvent;
  alert: AlertEvent;
  session_update: SessionUpdateEvent;
  command_result: CommandResultEvent;
}

export type DashboardEventName = keyof DashboardEvents;
