/** Stations (PCs): enrollment, live status, telemetry, peripherals. */

/** A station as other records refer to it (bookings, sessions, alerts…). */
export interface StationRef {
  id: string;
  name: string | null;
  serialNumber: string;
  branchId: string;
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
