import type { AlertCategory, AlertSeverity, AlertStatus } from '../../api/types';

export const CATEGORY_LABEL: Record<AlertCategory, string> = {
  hardware: 'Hardware',
  anti_theft: 'Anti-theft',
  security_violation: 'Security',
};

/** Alert types from the agent (BaronDesk.Shared AlertCodes) plus DEVICE_REMOVED for anti-theft. Unknown types show as-is. */
const TYPE_LABEL: Record<string, string> = {
  TEMPERATURE_WARNING: 'Overheating',
  CPU_USAGE: 'High CPU load',
  MEMORY_USAGE: 'High RAM use',
  HARDWARE_FAILURE: 'Hardware failure',
  DEVICE_REMOVED: 'Device removed',
};

export function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type;
}

export const SEVERITIES: AlertSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function isSevere(severity: AlertSeverity): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}

export const STATUS_LABEL: Record<AlertStatus, string> = {
  OPEN: 'Open',
  ACKED: 'Acknowledged',
  RESOLVED: 'Resolved',
};
