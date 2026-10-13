import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { imageSrc } from '../../lib/images';
import type { PublicGame } from '../../core/api-types';
import { u } from '../primitives/Art';
import { cx } from '../../lib/cx';
import styles from './GameCarousel.module.css';

/** A card and the gap after it, in design px (203 + 34). */
const STEP = 237;
/** Cards drawn on each side of the centered one: enough to fill a 430 px column. */
const AROUND = 2;

const mod = (k: number, n: number) => ((k % n) + n) % n;

/**
 * The game collection as an endless ring: drag it (finger or mouse) or use the
 * arrow keys, and after the last game comes the first again. `pos` is the
 * centered card's place on the ring; cards are drawn around it, each showing
 * game `k mod n`, so the ring never ends.
 */
export function GameCarousel({ games }: { games: PublicGame[] }) {
  const n = games.length;
  // It opens with a game centered and one peeking in on each side.
  const [pos, setPos] = useState(() => (n >= 3 ? 1 : 0));
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; pos: number; lastX: number; lastT: number; speed: number } | null>(null);

  if (n === 0) return null;
  const loops = n > 1;

  /** One step on screen, in px (the unit follows the phone's width). */
  const stepPx = () => {
    const card = box.current?.querySelector<HTMLElement>('.bd-game');
    return card ? (card.offsetWidth * STEP) / 203 : STEP;
  };

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!loops || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, pos, lastX: e.clientX, lastT: e.timeStamp, speed: 0 };
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const step = stepPx();
    const dt = Math.max(e.timeStamp - d.lastT, 1);
    d.speed = (e.clientX - d.lastX) / step / dt; // cards per ms
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    setPos(d.pos - (e.clientX - d.x) / step);
  }

  function onPointerUp() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    // A flick carries on to the next card; otherwise settle on the nearest one.
    setPos((p) => Math.round(p - d.speed * 180));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!loops) return;
    if (e.key === 'ArrowRight') setPos((p) => Math.round(p) + 1);
    else if (e.key === 'ArrowLeft') setPos((p) => Math.round(p) - 1);
    else return;
    e.preventDefault();
  }

  const center = Math.round(pos);
  const slots = loops ? Array.from({ length: AROUND * 2 + 1 }, (_, i) => center - AROUND + i) : [0];

  return (
    <div
      ref={box}
      className={dragging ? cx(styles.root, styles.dragging) : styles.root}
      role="region"
      aria-roledescription="carousel"
      aria-label="Our collection"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {slots.map((k) => {
        const game = games[mod(k, n)];
        const poster = imageSrc(game.iconUrl);
        return (
          <div
            key={k}
            className={styles.card}
            style={{ transform: `translateX(${u((k - pos) * STEP)})` }}
            aria-hidden={k !== center}
          >
            {poster ? <img src={poster} alt={game.name} draggable={false} /> : <span className={styles.name}>{game.name}</span>}
          </div>
        );
      })}
    </div>
  );
}
