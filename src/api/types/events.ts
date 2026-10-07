/** Live events of the /dashboard-io socket (brief §7). */

import type { Alert } from './alerts';
import type { Command } from './commands';
import type { MachineStatus, Peripheral, TelemetrySnapshot } from './stations';

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

/** The catalog_status event: sent after every agent catalog sync (games/services/games.service.ts recordStationStatus). */
export interface CatalogStatusEvent {
  machineId: string;
  serialNumber: string;
  branchId: string;
  reportedAt: string;
  games: { gameId: string; installed: boolean; reason: string | null }[];
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
