import type { ReactNode } from 'react';

import { cx } from '../../lib/cx';
import styles from './SectionTitle.module.css';

/** A section heading (h2 unless `as` says otherwise). */
export function SectionTitle({ as: Tag = 'h2', className, children }: { as?: 'h2' | 'h3'; className?: string; children: ReactNode }) {
  return <Tag className={cx(styles.root, className)}>{children}</Tag>;
}
