import type { ReactNode } from 'react';

import { PageErrorBoundary } from '../../shared/components/PageErrorBoundary';
import { BottomNav, type NavKey } from './BottomNav';
import './portal.css';

/**
 * One screen of the redesigned portal: the phone-width column, its background
 * and the bottom nav. `fit`: a one-screen design (Home) that also shrinks to
 * the phone's height, so nothing hides behind the nav on a short phone.
 */
export function Screen({ nav, fit = false, children }: { nav: NavKey; fit?: boolean; children: ReactNode }) {
  return (
    <div className="bd-stage">
      <div className={fit ? 'bd-app bd-fit' : 'bd-app'}>
        <PageErrorBoundary>{children}</PageErrorBoundary>
        <BottomNav active={nav} />
      </div>
    </div>
  );
}
