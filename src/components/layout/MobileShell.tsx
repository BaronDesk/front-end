import type { ReactNode } from 'react';

import { cx } from '../../lib/cx';

/**
 * A phone-width column with the design's background, centered on any screen,
 * and a nav under the page. `fit`: a one-screen design that also shrinks to
 * the phone's height, so nothing hides behind the nav.
 */
export function MobileShell({ fit = false, nav, children }: { fit?: boolean; nav: ReactNode; children: ReactNode }) {
  return (
    <div className="bd-stage">
      <div className={cx('bd-app', fit && 'bd-fit')}>
        {children}
        {nav}
      </div>
    </div>
  );
}
