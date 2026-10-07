import type { MenuItem } from '../shared/lib/menu';

// Gamer portal pages (Frontend Implementation Plan §4, step 9).
export const PORTAL_MENU: MenuItem[] = [
  { path: '/book', label: 'Book a station', step: 9 },
  { path: '/session', label: 'My session', step: 9 },
  { path: '/wallet', label: 'My wallet', step: 9 },
  { path: '/profile', label: 'My profile & plans', step: 9 },
  { path: '/settings', label: 'Settings', step: 9 },
];
