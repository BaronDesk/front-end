import type { MenuItem } from '../shared/menu';

// Order = the order staff use them at the desk. Role filtering comes in step 3.
export const ADMIN_MENU: MenuItem[] = [
  { path: '/stations', label: 'Stations', step: 5 },
  { path: '/enrollment', label: 'New stations', step: 5 },
  { path: '/sessions', label: 'Sessions', step: 7 },
  { path: '/reservations', label: 'Reservations', step: 7 },
  { path: '/wallet', label: 'Wallet', step: 7 },
  { path: '/alerts', label: 'Alerts', step: 6 },
  { path: '/users', label: 'Users & Staff', step: 7 },
  { path: '/plans', label: 'Plans', step: 7 },
  { path: '/games', label: 'Games', step: 7 },
  { path: '/hq', label: 'HQ overview', step: 8 },
];
