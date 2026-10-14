import { Outlet, useLocation } from 'react-router';

import { MobileShell } from '../../../components/layout/MobileShell';
import { PageErrorBoundary } from '../../../components/layout/PageErrorBoundary';
import { BottomNav, type NavKey } from './BottomNav';

/** Which nav item each page belongs to. */
const NAV: Record<string, NavKey> = {
  '/': 'home',
  '/events': 'home',
  '/book': 'book',
  '/profile': 'profile',
  '/settings': 'settings',
  '/history': 'settings',
  '/terms': 'settings',
  '/faq': 'settings',
  '/account': 'settings',
  '/plans': 'settings',
  '/session': 'book',
  '/wallet': 'profile',
};

/** One-screen designs: they also shrink to the phone's height. */
const FIT = new Set(['/']);

/**
 * The signed-in portal: the mobile shell around the page, with the bottom
 * nav. The nav stays mounted from page to page, so it animates to the new one.
 */
export function PortalShell() {
  const { pathname } = useLocation();
  return (
    <MobileShell fit={FIT.has(pathname)} nav={<BottomNav active={NAV[pathname] ?? 'home'} />}>
      {/* Keyed by page: an error on one page is gone on the next. */}
      <PageErrorBoundary key={pathname}>
        <Outlet />
      </PageErrorBoundary>
    </MobileShell>
  );
}
