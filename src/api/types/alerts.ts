/** Hardware, anti-theft and security alerts. */

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
