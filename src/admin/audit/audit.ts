import type { AuditLogEntry } from '../../api/types';

/**
 * The sensitive actions the backend records (to-do §S4), in the order of the
 * Action filter. The page shows any other action too (e.g. the schema's
 * generic CREATE / UPDATE), worded by `actionText`.
 */
export const AUDIT_ACTIONS = [
  'ROLE_CHANGED',
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'PASSWORD_RESET',
  'WALLET_REFUND',
  'STATION_SHUTDOWN',
  'STATION_REVOKED',
  'BRANCH_CREATED',
  'BRANCH_UPDATED',
  'PLAN_CREATED',
  'PLAN_UPDATED',
  'PLAN_DELETED',
  'PRICING_UPDATED',
] as const;

const ACTION_TEXT: Record<string, string> = {
  ROLE_CHANGED: 'Role changed',
  USER_SUSPENDED: 'Account suspended',
  USER_REACTIVATED: 'Account reactivated',
  PASSWORD_RESET: 'Password reset',
  WALLET_REFUND: 'Wallet refund',
  STATION_SHUTDOWN: 'Station shut down',
  STATION_REVOKED: 'Station revoked',
  BRANCH_CREATED: 'Branch created',
  BRANCH_UPDATED: 'Branch changed',
  PLAN_CREATED: 'Plan created',
  PLAN_UPDATED: 'Plan changed',
  PLAN_DELETED: 'Plan deleted',
  PRICING_UPDATED: 'Prices changed',
};

/** "ROLE_CHANGED" → "Role changed"; an unknown "SOME_THING" → "Some thing". */
export function actionText(action: string): string {
  if (ACTION_TEXT[action]) return ACTION_TEXT[action];
  const words = action.toLowerCase().replace(/_/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : '—';
}

/** Actions a manager or a gamer would want to double-check, shown in red. */
const SERIOUS = new Set<string>(['ROLE_CHANGED', 'USER_SUSPENDED', 'WALLET_REFUND', 'STATION_SHUTDOWN', 'STATION_REVOKED', 'PLAN_DELETED']);

export function isSerious(action: string): boolean {
  return SERIOUS.has(action);
}

const TARGET_KIND: Record<string, string> = {
  user: 'User',
  machine: 'Station',
  station: 'Station',
  branch: 'Branch',
  wallet: 'Wallet',
  'membership-plan': 'Tier',
  'subscription-plan': 'Pass',
  pricing: 'Prices',
  session: 'Session',
};

/**
 * What the action was done to. The backend writes `target` as `<kind>:<id>`
 * (e.g. `user:3f2…`) and may name it in `metadata.targetName`; anything else
 * is shown as it is.
 */
export function targetText(entry: Pick<AuditLogEntry, 'target' | 'metadata'>): string {
  const name = typeof entry.metadata?.targetName === 'string' ? entry.metadata.targetName : null;
  const sep = entry.target.indexOf(':');
  if (sep <= 0) return name ?? entry.target;
  const kind = entry.target.slice(0, sep);
  const id = entry.target.slice(sep + 1);
  const label = TARGET_KIND[kind] ?? kind;
  return `${label} ${name ?? (id.length > 8 ? `${id.slice(0, 8)}…` : id)}`;
}

/** `metadata` as "from: EMPLOYEE · to: MANAGER", without the name already shown as the target. */
export function detailsText(metadata: AuditLogEntry['metadata']): string {
  if (!metadata) return '';
  return Object.entries(metadata)
    .filter(([key, value]) => key !== 'targetName' && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}
