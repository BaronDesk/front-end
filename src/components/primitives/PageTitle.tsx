import type { ReactNode } from 'react';

import { cx } from '../../lib/cx';
import styles from './PageTitle.module.css';

/** A page's big title (Neue Kaine Regular 30, as on Bookings); an h1 unless `as` says otherwise. */
export function PageTitle({ as: Tag = 'h1', className, children }: { as?: 'h1' | 'h2'; className?: string; children: ReactNode }) {
  return <Tag className={cx(styles.root, className)}>{children}</Tag>;
}
