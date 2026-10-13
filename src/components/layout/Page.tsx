import type { ReactNode } from 'react';

import { cx } from '../../lib/cx';
import styles from './Page.module.css';

/** A scrolling page inside the mobile shell: room above the title and above the nav. */
export function Page({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx(styles.root, className)}>{children}</div>;
}
