import type { MenuItem } from '../shared/menu';

// Every portal page is built in step 9 (Frontend Implementation Plan §4).
export const PORTAL_MENU: MenuItem[] = [
  { path: '/availability', label: 'Free stations', step: 9 },
  { path: '/book', label: 'Book a station', step: 9 },
  { path: '/wallet', label: 'My wallet', step: 9 },
  { path: '/session', label: 'My session', step: 9 },
  { path: '/profile', label: 'My profile', step: 9 },
];
