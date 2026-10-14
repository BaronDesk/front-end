import { useRef } from 'react';

import { imageSrc } from '../../lib/images';
import type { PublicGame } from '../../core/api-types';
import { u } from '../primitives/Art';
import { cx } from '../../lib/cx';
import { useRing } from './useRing';
import styles from './GameCarousel.module.css';

/** A card and the gap after it, in design px (203 + 34). */
const STEP = 237;
/** Cards drawn on each side of the centered one: enough to fill a 430 px column. */
const AROUND = 2;

/**
 * The game collection as an endless ring: drag it (finger or mouse) or use the
 * arrow keys, and after the last game comes the first again (useRing).
 */
export function GameCarousel({ games }: { games: PublicGame[] }) {
  const n = games.length;
  const box = useRef<HTMLDivElement>(null);
  /** One step on screen, in px (the unit follows the phone's width). */
  const stepPx = () => {
    const card = box.current?.querySelector<HTMLElement>(`.${styles.card}`);
    return card ? (card.offsetWidth * STEP) / 203 : STEP;
  };
  // It opens with a game centered and one peeking in on each side.
  const ring = useRing(n, { around: AROUND, stepPx, start: n >= 3 ? 1 : 0 });

  if (n === 0) return null;

  return (
    <div
      ref={box}
      className={ring.dragging ? cx(styles.root, styles.dragging) : styles.root}
      role="region"
      aria-roledescription="carousel"
      aria-label="Our collection"
      tabIndex={0}
      {...ring.handlers}
    >
      {ring.slots.map((k) => {
        const game = games[ring.index(k)];
        const poster = imageSrc(game.iconUrl);
        return (
          <div
            key={k}
            className={styles.card}
            style={{ transform: `translateX(${u((k - ring.pos) * STEP)})` }}
            aria-hidden={k !== ring.center}
          >
            {poster ? <img src={poster} alt={game.name} draggable={false} /> : <span className={styles.name}>{game.name}</span>}
          </div>
        );
      })}
    </div>
  );
}
