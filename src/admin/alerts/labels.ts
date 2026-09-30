import type { Alert, AlertCategory, AlertSeverity } from '../../api/types';

export const ALERTS_PATH = '/api/v1/alerts';

export const CATEGORY_LABEL: Record<AlertCategory, string> = {
  hardware: 'Hardware',
  anti_theft: 'Anti-theft',
  security_violation: 'Security',
};

/** Alert types from the agent (BaronDesk.Shared AlertCodes) plus the legacy device_disconnected. Unknown types show as-is. */
const TYPE_LABEL: Record<string, string> = {
  TEMPERATURE_WARNING: 'Overheating',
  CPU_USAGE: 'High CPU load',
  MEMORY_USAGE: 'High RAM use',
  HARDWARE_FAILURE: 'Hardware failure',
  DEVICE_REMOVED: 'Device removed',
  LOCK_SCREEN_MISSING: 'Lock screen missing',
  IPC_TAMPERING: 'Lock screen tampering',
  device_disconnected: 'Device removed',
};

export function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type;
}

export const SEVERITIES: AlertSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function isSevere(severity: AlertSeverity): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}

/** The alert's text: the agent's message, else what a legacy device event said. */
export function alertDetail(a: Alert): string {
  const v = a.value ?? {};
  if (v.message) return v.message;
  if (v.deviceName || v.deviceType) return `${v.deviceType ?? 'Device'} "${v.deviceName ?? '?'}" disconnected`;
  return '';
}

/** "×3" when the station raised the same alert again while it was open. */
export function repeatText(a: Alert): string {
  const n = a.value?.repeatCount;
  return typeof n === 'number' && n > 1 ? `×${n}` : '';
}
