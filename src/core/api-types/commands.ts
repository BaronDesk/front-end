/** Remote commands sent to stations. */

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
