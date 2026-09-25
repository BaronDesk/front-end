import type { MenuItem } from '../shared/menu';

// Order = the order staff use them at the desk. Roles follow brief §5:
// Staff = EMPLOYEE, Branch admin = MANAGER, HQ = ADMIN.
export const ADMIN_MENU: MenuItem[] = [
  { path: '/stations', label: 'Stations', step: 5 },
  { path: '/enrollment', label: 'New stations', step: 5, minRole: 'MANAGER' },
  { path: '/sessions', label: 'Sessions', step: 7 },
  { path: '/reservations', label: 'Reservations', step: 7 },
  { path: '/wallet', label: 'Wallet', step: 7 },
  { path: '/alerts', label: 'Alerts', step: 6 },
  { path: '/users', label: 'Users & Staff', step: 7, minRole: 'MANAGER' },
  { path: '/plans', label: 'Plans', step: 7, minRole: 'MANAGER' },
  { path: '/games', label: 'Games', step: 7, minRole: 'MANAGER' },
  { path: '/hq', label: 'HQ overview', step: 8, minRole: 'ADMIN' },
];
