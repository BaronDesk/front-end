/** The HQ audit log. */

/**
 * GET /audit-logs (HQ only), newest first. Filters: `branchId`, `from` (ISO),
 * `action`, `q` (who or what, by name), `limit`. Not on the backend yet
 * (to-do "Audit log", §S4): the Audit page shows a notice while it answers 404.
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  /** e.g. ROLE_CHANGED, WALLET_REFUND (src/admin/audit/audit.ts); any string is shown. */
  action: string;
  /** `<kind>:<id>`, e.g. `user:3f2…`, `machine:…`, `branch:…`. */
  target: string;
  /** Free details, e.g. { targetName, from, to, amount, reason }. */
  metadata: Record<string, unknown> | null;
  /** Who did it. */
  userId: string;
  username: string | null;
  /** The branch concerned; null for HQ-wide actions (branches, plans). */
  branchId: string | null;
}
