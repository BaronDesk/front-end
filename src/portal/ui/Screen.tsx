import type { ReactNode } from 'react';

import { PageErrorBoundary } from '../../shared/components/PageErrorBoundary';
import { BottomNav, type NavKey } from './BottomNav';
import './portal.css';

/** One screen of the redesigned portal: the phone-width column, its background and the bottom nav. */
export function Screen({ nav, children }: { nav: NavKey; children: ReactNode }) {
  return (
    <div className="bd-stage">
      <div className="bd-app">
        <PageErrorBoundary>{children}</PageErrorBoundary>
        <BottomNav active={nav} />
      </div>
    </div>
  );
}
