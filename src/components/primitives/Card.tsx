import type { ElementType, HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';
import styles from './Card.module.css';

/** A Card in the portal's style; `as` picks the element (p, section, article…), `tone="alert"` outlines it in red. */
export function Card({ as: Tag = 'div', tone, className, children, ...rest }: { as?: ElementType; tone?: 'alert'; className?: string; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cx(styles.root, tone === 'alert' && styles.alert, className)} {...rest}>
      {children}
    </Tag>
  );
}
