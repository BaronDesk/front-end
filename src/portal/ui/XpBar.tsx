import { useId, useLayoutEffect, useRef, useState } from 'react';

import type { PublicUser } from '../../api/types';

/** The bar's left end curves around the avatar (Figma "XP Bar", 237 × 28). */
const CURVE = 'H3.15332C2.06901 28 1.01347 27.8768 0 27.6436C5.31287 22.1606 8.58105 14.7099 8.58105 6.5C8.58105 4.26914 8.33778 2.09467 7.87988 0';

/** The bar's outline or its fill, ending in a half circle at `end` + 14. */
function barPath(end: number): string {
  return `M${end} 0C${end + 7.732} 0 ${end + 14} 6.268 ${end + 14} 14C${end + 14} 21.732 ${end + 7.732} 28 ${end} 28${CURVE}H${end}Z`;
}

/** Narrowest fill: room for the XP figure inside it (as drawn: 58 px). */
const MIN_FILL = 58.15;

/** How far the gamer is from their rank to the next one, 0..1 (full at the top rank). */
export function xpProgress(user: Pick<PublicUser, 'xp' | 'rank' | 'nextRank'>): number {
  if (!user.nextRank) return 1;
  const from = user.rank?.minXp ?? 0;
  const span = user.nextRank.minXp - from;
  return span > 0 ? Math.min(Math.max(((user.xp ?? 0) - from) / span, 0), 1) : 0;
}

/**
 * The gamer's XP, filled towards the next rank. The right figure is the
 * last XP of the current rank (Wood: 0 → 499).
 */
export function XpBar({ user }: { user: Pick<PublicUser, 'xp' | 'rank' | 'nextRank'> }) {
  const box = useRef<HTMLDivElement>(null);
  const maskId = useId();
  // The bar's size on screen; it is drawn in Figma px (28 high) and scaled to fit.
  const [size, setSize] = useState({ width: 237.153, height: 28 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const width = size.height > 0 ? (size.width * 28) / size.height : 237.153;
  const fill = Math.max(MIN_FILL, xpProgress(user) * width);
  const goal = user.nextRank ? `${user.nextRank.minXp - 1}XP` : 'MAX';

  return (
    <div className="bd-xp" ref={box} role="img" aria-label={`${user.xp ?? 0} XP${user.nextRank ? `, ${user.nextRank.name} at ${user.nextRank.minXp} XP` : ''}`}>
      <svg width={size.width} height={size.height} viewBox={`0 0 ${width} 28`} aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <path d={barPath(width - 14)} fill="white" />
          </mask>
        </defs>
        {/* A 1 px outline drawn inside the shape, as in Figma. */}
        <path d={barPath(width - 14)} fill="none" stroke="black" strokeOpacity={0.66} strokeWidth={2} mask={`url(#${maskId})`} />
        <path d={barPath(Math.min(fill, width) - 14)} fill="#362822" fillOpacity={0.94} />
      </svg>
      <span className="bd-xp-value">{user.xp ?? 0}XP</span>
      <span className="bd-xp-goal">{goal}</span>
    </div>
  );
}
