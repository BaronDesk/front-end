import type { ReactNode } from 'react';

import { u } from './units';

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
    <div className={footer ? 'bd-plan-card bd-plan-card-tall' : 'bd-plan-card'} style={{ borderTopLeftRadius: u(corner) }}>
      {badge && <img className="bd-plan-badge" src={badge} alt="" style={{ left: u(at[0]), top: u(at[1]), width: u(size), height: u(size) }} />}
      {empty && <span className="bd-plan-none" aria-hidden="true" />}
      <span className="bd-plan-divider" style={{ left: u(tier ? 155 : 153) }} />
      <p className="bd-plan-title" style={{ left: u(tier ? 169 : 168) }}>
        {title}
      </p>
      <p className={tier ? 'bd-plan-lines bd-plan-lines-tier' : 'bd-plan-lines'}>
        {lines[0]}
        {lines[1] && (
          <>
            <br />
            {lines[1]}
          </>
        )}
      </p>
      {footer && <div className="bd-plan-footer">{footer}</div>}
    </div>
  );
}
