/*
 * Shapes the frontend reads from the backend (back-end/src DTOs, checked
 * against the running API). Money: Int columns are millimes (1 DT = 1000);
 * plan prices and discount percents are Prisma Decimals, sent as strings.
 */

export type Role = 'GAMER' | 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'DELETED';

/** identity/util/public-user.ts */
export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  accountStatus: AccountStatus;
  /** The branch a staff member works at. null = HQ / global scope, or a gamer. */
  branchId: string | null;
  /** A gamer's profile id (wallet, bookings); null for staff. */
  gamerProfileId: string | null;
  /** The branch a gamer plays at: the booking page lists its stations. */
  homeBranchId: string | null;
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

/**
 * A branch (GET /branches; HQ creates and edits them with POST / PATCH
 * /branches). Until the list loads, ids come from GET /machines and the label
 * is built from the PC serial numbers (admin/branch/branches.ts).
 */
export interface Branch {
  id: string;
  name: string;
  /** From GET /branches; absent for a branch only known by id. */
  location?: string;
}

/** GET /branches/:id/stations: a station as the booking page shows it (never who booked). */
export interface BranchStation {
  id: string;
  name: string;
  serialNumber: string;
  online: boolean;
  busyNow: boolean;
  /** End of the current booking (back-to-back ones chained), when busy now. */
  busyUntil: string | null;
  /** Bookings in the next 7 days. */
  bookings: { startTime: string; endTime: string }[];
}

/** GET /sessions/me/current: the gamer's own session now (null when not playing). */
export interface CurrentSession {
  sessionId: string;
  reservationId: string;
  status: SessionStatus;
  /** 'runout' = locked for lack of money, 'offline' = the PC dropped off. */
  lockReason: string | null;
  station: { id: string; name: string | null; serialNumber: string; branchId: string };
  startedAt: string;
  endsAt: string;
  rateCentsPerMinute: number;
  playedSeconds: number;
  costSoFarCents: number;
  balance: number;
  /** What the wallet holds once this session is paid. */
  balanceAfterCents: number;
}

/** GET /reservations/:id/extend-options. */
export interface ExtendOptions {
  reservationId: string;
  endsAt: string;
  options: { minutes: number; costCents: number; available: boolean; reason: 'SLOT_TAKEN' | 'INSUFFICIENT_FUNDS' | null }[];
}

/** GET /api/v1/reservations (staff): a booking with who booked it and on which station. */
export interface StaffReservation extends Reservation {
  gamerUsername: string;
  machine: { id: string; name: string | null; serialNumber: string; branchId: string };
}

/** GET /sessions (staff). */
export interface SessionListItem extends Session {
  station: { id: string; name: string | null; serialNumber: string; branchId: string };
  gamerUsername: string;
  /** Open sessions only: what it has cost so far. */
  costSoFarCents: number | null;
}

/** GET /api/v1/stations/:id/telemetry/history: one sample a minute. */
export interface TelemetryHistoryRow {
  recordedAt: string;
  metrics: Record<string, number>;
}

/** A watched peripheral, as the station reports it. */
export interface Peripheral {
  deviceId: string;
  name: string | null;
  vendorProductId: string | null;
  connected: boolean;
  changedAt: string | null;
}

/** session_notice (to the gamer): what the station shows in its corner box. */
export interface SessionNoticeEvent {
  sessionId: string;
  reservationId: string;
  kind: 'LOW_BALANCE' | 'TIME_LEFT' | 'CLEAR';
  /** When the station locks. */
  endsAt: string | null;
}

/** peripheral_status (staff). */
export interface PeripheralStatusEvent {
  machineId: string;
  serialNumber: string;
  branchId: string;
  reportedAt: string;
  peripherals: Peripheral[];
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
  /** Not in the backend's list: the frontend fills it from GET /machines. */
  branchId?: string;
}

/**
 * Backend MachineEnrollmentStatus. PENDING = asked to join, waiting for an
 * admin; ENROLLED = approved, may connect; DEACTIVATED = rejected or revoked.
 */
export type MachineEnrollmentStatus = 'PENDING' | 'ENROLLED' | 'INACTIVE' | 'DEACTIVATED';

/** GET /api/v1/stations/:id */
export interface StationDetail extends Station {
  branchId: string;
  enrollmentStatus: MachineEnrollmentStatus;
  /** When the agent's unlock lease runs out, if it reported one. */
  leaseExpiresAt: string | null;
  /** The watched peripherals the station last reported (null: never reported). */
  peripherals: Peripheral[] | null;
  peripheralsReportedAt: string | null;
}

/**
 * GET /machines[/:id] and POST /machines/:id/approve|reject|revoke
 * (machines/util/public-machine.ts toPublicMachine): the enrollment view of a PC.
 */
export interface Machine {
  id: string;
  serialNumber: string;
  branchId: string;
  agentPublicKey: string;
  enrollmentStatus: MachineEnrollmentStatus;
  /** The PC's name as the agent sent it. */
  name: string | null;
  status: MachineStatus;
  lastSeen: string | null;
  /** When it asked to join. */
  createdAt: string;
}

/**
 * POST /machines/enrollment-tokens ({ branchId, ttlMinutes? }) and
 * POST /machines/:id/rotate-token. Shown once: the server keeps only its hash.
 */
export interface EnrollmentToken {
  token: string;
  expiresAt: string;
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

/**
 * exe: target is the full path of the .exe. steam: target is the Steam app id.
 * epic: target is the Epic AppName (no arguments, no working directory).
 */
export type GameLaunchType = 'exe' | 'steam' | 'epic';

/** GET / POST / PATCH /api/v1/games (games/services/games.service.ts toGameDto). */
export interface Game {
  /** Row id (uuid): what the /games/:id routes and Command.gameId use. */
  id: string;
  /** Wire id (e.g. "cs2"): what LAUNCH_GAME, the agent's catalog and runningGameId use. */
  gameId: string;
  name: string;
  launchType: GameLaunchType;
  target: string;
  arguments: string | null;
  workingDirectory: string | null;
  /** e.g. cs2.exe: lets the agent track the game and close it at session end. */
  processName: string | null;
  iconUrl: string | null;
  /** A disabled game stays in the catalog but reaches no station. */
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Where it is offered (staff list only), limited to the caller's branch unless HQ. */
  assignments?: GameAssignments;
}

export interface GameAssignments {
  /** Offered at every station of these branches… */
  branchIds: string[];
  /** …and on these single stations… */
  stationIds: string[];
  /** …except these, taken off although their branch offers it. */
  excludedStationIds: string[];
}

/** GET /api/v1/games/installed: a launcher game the stations found installed. */
export interface InstalledGame {
  launchType: 'steam' | 'epic';
  target: string;
  name: string;
  processName: string | null;
  stations: { id: string; name: string | null; serialNumber: string }[];
  reportedAt: string;
  /** The catalog entry with this launcher target, if any. */
  catalogGame: { id: string; gameId: string; name: string } | null;
}

/** POST /api/v1/games body (PATCH takes any subset). */
export interface GameInput {
  gameId: string;
  name: string;
  launchType: GameLaunchType;
  target: string;
  arguments?: string | null;
  workingDirectory?: string | null;
  processName?: string | null;
  iconUrl?: string | null;
  enabled?: boolean;
  sortOrder?: number;
}

/**
 * GET /api/v1/stations/:id/games: the station's resolved catalog (offered at
 * its branch or on the station itself, per-station overrides applied) with
 * what the agent last reported. It does not say which of the two assignments
 * put a game there.
 */
export interface StationGame {
  id: string;
  gameId: string;
  name: string;
  launchType: GameLaunchType;
  target: string;
  arguments: string | null;
  workingDirectory: string | null;
  processName: string | null;
  /** null until the station has reported on this game (after its next catalog sync). */
  installed: boolean | null;
  reason: string | null;
  reportedAt: string | null;
}

/** PUT /api/v1/games/:id/stations/:stationId body: per-station overrides, null = the game's own value. */
export interface StationGameOverrides {
  target?: string | null;
  arguments?: string | null;
  workingDirectory?: string | null;
}

/** The catalog_status event: sent after every agent catalog sync (games/services/games.service.ts recordStationStatus). */
export interface CatalogStatusEvent {
  machineId: string;
  serialNumber: string;
  branchId: string;
  reportedAt: string;
  games: { gameId: string; installed: boolean; reason: string | null }[];
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

/** wallet ledger entry types (Prisma TransactionType). A session charge is a PAYMENT with a sessionId. */
export type TransactionType = 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'CREDIT' | 'DEBIT';

/** GET /wallets/me, GET /wallets/:gamerProfileId (wallet/util/public-wallet.ts). */
export interface Wallet {
  id: string;
  /** The gamer's profile id: what every staff wallet route takes (the "member code"). */
  gamerProfileId: string;
  /** Millimes. */
  balance: number;
  updatedAt: string;
}

/** GET …/entries, POST …/credit and …/debit. */
export interface WalletEntry {
  id: string;
  walletId: string;
  /** Millimes: positive = credit, negative = debit. */
  amount: number;
  balanceAfter: number;
  type: TransactionType;
  /** Set on a session charge. */
  sessionId: string | null;
  createdAt: string;
}

/** POST /wallets/:gamerProfileId/credit|debit body. */
export interface WalletMovement {
  /** Millimes, a positive whole number. */
  amount: number;
  type?: TransactionType;
  sessionId?: string;
  idempotencyKey?: string;
}

/** GET/POST/PATCH /membership-plans. price and discountPercent are Decimals (strings on the wire). */
export interface MembershipPlan {
  id: string;
  name: string;
  /** Dinars, e.g. "15". */
  price: string;
  durationDays: number;
  discountPercent: string;
  /** How many days ahead a member may book. */
  bookingAdvanceDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipPlanInput {
  name: string;
  price: number;
  durationDays: number;
  discountPercent: number;
  bookingAdvanceDays?: number;
}

/**
 * A pass's benefits. The create schema takes time windows; the seed also
 * stores other shapes (free_hours, unlimited_free_play), so anything is shown.
 */
export interface SubscriptionBenefits {
  windows?: { daysOfWeek: number[]; startTime: string; endTime: string; discountPercent: number }[];
  [key: string]: unknown;
}

/** GET/POST/PATCH /subscription-plans. */
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  durationDays: number;
  benefits: SubscriptionBenefits;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanInput {
  name: string;
  price: number;
  durationDays: number;
  benefits: { windows: NonNullable<SubscriptionBenefits['windows']> };
}

export type PlanStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED' | 'PENDING';

/** GET /memberships/me item, and POST /membership-plans/:id/purchase. */
export interface Membership {
  id: string;
  gamerProfileId: string;
  membershipPlanId: string;
  discountPercentSnapshot: string;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  membershipPlan?: MembershipPlan;
}

/** GET /subscriptions/me item, and POST /subscription-plans/:id/purchase. */
export interface Subscription {
  id: string;
  gamerProfileId: string;
  subscriptionPlanId: string;
  benefitsSnapshot: SubscriptionBenefits;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  subscriptionPlan?: SubscriptionPlan;
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
  machine?: { id: string; name: string | null; serialNumber: string; branchId: string };
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

/** POST /sessions answer: the session plus the one-time PIN the gamer types on the lock screen. */
export interface StartedSession extends Session {
  pin: string;
}

/**
 * GET / PUT /branches/:branchId/pricing (pricing/util/public-pricing.ts).
 * Rates are integer millimes (1/1000 dinar) per hour; GET is 404
 * PRICING_NOT_SET until a manager sets them, and a session can't start then.
 */
export interface BranchPricing {
  id: string;
  branchId: string;
  /** Play now (walk-in). */
  paygRate: number;
  /** Play booked ahead. */
  bookingRate: number;
  updatedAt: string;
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

/** session_runout_warning: the gamer's balance runs out soon (session-billing runout timer). */
export interface SessionRunoutWarningEvent {
  sessionId: string;
  machineId: string;
}

export interface DashboardEvents {
  station_status: StationStatusEvent;
  telemetry_update: TelemetrySnapshot;
  /** A new alert, or a repeat of an open one (same id, higher value.repeatCount). */
  alert: Alert;
  alert_resolved: Alert;
  session_runout_warning: SessionRunoutWarningEvent;
  /** Every status change of a command, from PENDING to its final status. */
  command_update: Command;
  catalog_status: CatalogStatusEvent;
  /** Gamer only: low balance / time left / clear. */
  session_notice: SessionNoticeEvent;
  peripheral_status: PeripheralStatusEvent;
}

export type DashboardEventName = keyof DashboardEvents;
