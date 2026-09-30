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

/**
 * GET /api/v1/stations/:id/telemetry and the telemetry_update event
 * (ops/services/telemetry.service.ts TelemetrySnapshot). The server merges the
 * agent's delta frames, so `metrics` is always the full set. Metric names come
 * from the agent's HardwareTelemetryMapper (e.g. cpu.temperature_c, gpu.0.load_percent).
 */
export interface TelemetrySnapshot {
  serialNumber: string;
  machineId: string;
  branchId: string;
  /** Newest sampledAt among the frame's readings. */
  timestamp: string;
  receivedAt: string;
  metrics: Record<string, number>;
}

export interface Game {
  id: string;
  title: string;
  executablePath: string;
  genre: string;
  cover: string | null;
}

/** The commands staff can issue (ops/schemas/command.schemas.ts STATION_COMMAND_TYPES). */
export type CommandType = 'LOCK' | 'UNLOCK' | 'SHUTDOWN' | 'LAUNCH_GAME' | 'END_SESSION' | 'CATALOG_UPDATE';

/**
 * PENDING (row created) → SENT (delivered to the agent, maybe retried) → one of
 * ACKED (the agent accepted it; not "finished"), NACKED (STALE or an unknown
 * code), FAILED (UNKNOWN_TYPE / INVALID_PAYLOAD / EXEC_FAILED, or not
 * deliverable), TIMEOUT (no reply). A late ack or nack can still replace TIMEOUT.
 */
export type CommandStatus = 'PENDING' | 'SENT' | 'ACKED' | 'NACKED' | 'FAILED' | 'TIMEOUT';

/** POST /api/v1/stations/:id/commands body. */
export interface IssueCommandBody {
  type: CommandType;
  /** LAUNCH_GAME only: the catalog's wire gameId. */
  gameId?: string;
  /** END_SESSION only; the agent defaults it to "normal". */
  reason?: string;
}

/**
 * POST (202) / GET /api/v1/stations/:id/commands, GET /api/v1/commands/:id and
 * the command_update event (ops/services/commands.service.ts toCommandDto).
 */
export interface Command {
  commandId: string;
  machineId: string;
  branchId: string;
  type: CommandType;
  /** LAUNCH_GAME: the GAME row id (uuid), not the wire gameId. */
  gameId: string | null;
  status: CommandStatus;
  issuedBy: string;
  issuedAt: string;
  sentAt: string | null;
  resolvedAt: string | null;
  attempts: number;
  /** The agent's nack code (STALE, EXEC_FAILED, …) and its human-readable reason. */
  nackCode: string | null;
  nackReason: string | null;
  /** Why the server gave up (timeout, enqueue failure). */
  failureReason: string | null;
}

/** Lower-case on the API. An unknown agent category is stored as hardware (raw value in value.agentCategory). */
export type AlertCategory = 'hardware' | 'anti_theft' | 'security_violation';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
/** GET /api/v1/alerts?status= */
export type AlertStatus = 'open' | 'resolved';

/** Free-form `value` of an alert. Agent alerts carry message/occurredAt; repeats add repeatCount. */
export interface AlertValue {
  serialNumber?: string;
  message?: string;
  occurredAt?: string;
  /** Set once the same alert came again within 5 minutes (updated in place, re-sent as `alert`). */
  repeatCount?: number;
  firstOccurredAt?: string | null;
  /** Legacy device_event alerts. */
  deviceType?: string | null;
  deviceName?: string | null;
  [key: string]: unknown;
}

/**
 * GET /api/v1/alerts, POST /api/v1/alerts/:id/resolve and the alert /
 * alert_resolved events (ops/services/alerts.service.ts toAlertDto).
 * There is no separate acknowledge step: acknowledged = resolved.
 */
export interface Alert {
  id: string;
  machineId: string;
  serialNumber: string | null;
  /** null once the branch was deleted: only HQ sees those. */
  branchId: string | null;
  category: AlertCategory;
  type: string;
  severity: AlertSeverity;
  value: AlertValue | null;
  acknowledged: boolean;
  acknowledgedByUserId: string | null;
  acknowledgedAt: string | null;
  /** When it happened on the station (the agent's occurredAt). */
  createdAt: string;
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

export interface DashboardEvents {
  station_status: StationStatusEvent;
  telemetry_update: TelemetrySnapshot;
  /** A new alert, or a repeat of an open one (same id, higher value.repeatCount). */
  alert: Alert;
  alert_resolved: Alert;
  session_update: SessionUpdateEvent;
  /** Every status change of a command, from PENDING to its final status. */
  command_update: Command;
}

export type DashboardEventName = keyof DashboardEvents;
