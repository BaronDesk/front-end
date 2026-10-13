import type { ReactNode } from 'react';

import { u } from '../primitives/Art';
import { cx } from '../../lib/cx';
import styles from './PlanCard.module.css';

/**
 * One plan card (Figma "Membership Card"): the badge overflowing its left
 * side, a line, the name and two lines. As drawn, the tier card's line and
 * text sit 1–2 px right of the pass card's (`tier`). `empty`: the "No Plans"
 * card's crossed-out circle instead of a badge. `footer`: a row under the
 * text (the buying page's price and button), which makes the card taller.
 */
export function PlanCard({ badge, size, at, corner, title, lines, empty = false, tier = false, footer }: {
  badge: string | null | undefined;
  size: number;
  at: [number, number];
  corner: number;
  title: string;
  lines: [string, string];
  empty?: boolean;
  tier?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className={footer ? cx(styles.root, styles.tall) : styles.root} style={{ borderTopLeftRadius: u(corner) }}>
      {badge && <img className={styles.badge} src={badge} alt="" style={{ left: u(at[0]), top: u(at[1]), width: u(size), height: u(size) }} />}
      {empty && <span className={styles.none} aria-hidden="true" />}
      <span className={styles.divider} style={{ left: u(tier ? 155 : 153) }} />
      <p className={styles.title} style={{ left: u(tier ? 169 : 168) }}>
        {title}
      </p>
      <p className={tier ? cx(styles.lines, styles.linesTier) : styles.lines}>
        {lines[0]}
        {lines[1] && (
          <>
            <br />
            {lines[1]}
          </>
        )}
      </p>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
