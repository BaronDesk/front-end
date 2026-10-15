import type { Role } from '../../core/api-types';

export interface MenuItem {
  path: string;
  label: string;
  /** Lowest role that sees the item. Omitted = every role of the app. */
  minRole?: Role;
}

// In the order staff use them at the desk. Roles: Staff = EMPLOYEE, Branch admin = MANAGER, HQ = ADMIN.
export const DESK_MENU: MenuItem[] = [
  { path: '/stations', label: 'Stations' },
  { path: '/enrollment', label: 'New stations', minRole: 'MANAGER' },
  { path: '/bookings', label: 'Bookings' },
  { path: '/wallet', label: 'Wallet' },
  { path: '/alerts', label: 'Alerts' },
  { path: '/users', label: 'Users & Staff', minRole: 'MANAGER' },
  { path: '/plans', label: 'Plans', minRole: 'MANAGER' },
  { path: '/ranks', label: 'Ranks', minRole: 'MANAGER' },
  { path: '/games', label: 'Games', minRole: 'MANAGER' },
  { path: '/tournaments', label: 'Tournaments', minRole: 'MANAGER' },
  { path: '/hq', label: 'HQ overview', minRole: 'ADMIN' },
  { path: '/audit', label: 'Audit log', minRole: 'ADMIN' },
];
