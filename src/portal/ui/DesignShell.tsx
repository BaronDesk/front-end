import { Outlet, useLocation } from 'react-router';

import { PageErrorBoundary } from '../../shared/components/PageErrorBoundary';
import { BottomNav, type NavKey } from './BottomNav';
import './portal.css';

/** Which nav item each redesigned page belongs to. */
const NAV: Record<string, NavKey> = {
  '/': 'home',
  '/events': 'home',
  '/book': 'book',
  '/profile': 'profile',
  '/settings': 'settings',
  '/history': 'settings',
  '/terms': 'settings',
  '/faq': 'settings',
};

/** One-screen designs: they also shrink to the phone's height, so nothing hides behind the nav. */
const FIT = new Set(['/', '/events']);

/**
 * The signed-in screens of the redesigned portal: the phone-width column, its
 * background and the bottom nav, around the page. The nav stays mounted from
 * page to page, so it animates to the new one.
 */
export function DesignShell() {
  const { pathname } = useLocation();
  return (
    <div className="bd-stage">
      <div className={FIT.has(pathname) ? 'bd-app bd-fit' : 'bd-app'}>
        {/* Keyed by page: an error on one page is gone on the next. */}
        <PageErrorBoundary key={pathname}>
          <Outlet />
        </PageErrorBoundary>
        <BottomNav active={NAV[pathname] ?? 'home'} />
      </div>
    </div>
  );
}
