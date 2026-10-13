import type { Role } from '../../core/api-types';

export interface MenuItem {
  path: string;
  label: string;
  /** Plan step that builds the page (Frontend Implementation Plan §4). */
  step: number;
  /** Lowest role that sees the item (brief §5). Omitted = every role of the app. */
  minRole?: Role;
}

// Order = the order staff use them at the desk. Roles follow brief §5:
// Staff = EMPLOYEE, Branch admin = MANAGER, HQ = ADMIN.
export const DESK_MENU: MenuItem[] = [
  { path: '/stations', label: 'Stations', step: 5 },
  { path: '/enrollment', label: 'New stations', step: 5, minRole: 'MANAGER' },
  { path: '/sessions', label: 'Sessions', step: 7 },
  { path: '/bookings', label: 'Bookings', step: 7 },
  { path: '/wallet', label: 'Wallet', step: 7 },
  { path: '/alerts', label: 'Alerts', step: 6 },
  { path: '/users', label: 'Users & Staff', step: 7, minRole: 'MANAGER' },
  { path: '/plans', label: 'Plans', step: 7, minRole: 'MANAGER' },
  { path: '/ranks', label: 'Ranks', step: 7, minRole: 'MANAGER' },
  { path: '/games', label: 'Games', step: 7, minRole: 'MANAGER' },
  { path: '/hq', label: 'HQ overview', step: 8, minRole: 'ADMIN' },
  { path: '/audit', label: 'Audit log', step: 8, minRole: 'ADMIN' },
];
