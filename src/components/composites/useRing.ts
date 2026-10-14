import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

/** How far the pointer moves before a press becomes a drag: a shorter press stays a tap on what is under it. */
const DRAG_FROM_PX = 6;

/**
 * An endless ring of `n` cards, dragged with a finger or the mouse or moved
 * with the arrow keys: after the last card comes the first again. `pos` is
 * the centered card's place on the ring; `slots` are the places to draw
 * around it (card `k mod n` in each), `around` on each side. `stepPx` gives
 * one card plus its gap on screen, in px.
 */
export function useRing(n: number, { around, stepPx, start = 0 }: { around: number; stepPx: () => number; start?: number }) {
  const [pos, setPos] = useState(start);
  const [dragging, setDragging] = useState(false);
  const press = useRef<{ x: number; pos: number; lastX: number; lastT: number; speed: number; moved: boolean } | null>(null);
  // Set when a drag ends, so the click that follows doesn't open the card under the finger.
  const dragged = useRef(false);
  const loops = n > 1;

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (!loops || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dragged.current = false;
    press.current = { x: e.clientX, pos, lastX: e.clientX, lastT: e.timeStamp, speed: 0, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const p = press.current;
    if (!p) return;
    if (!p.moved) {
      if (Math.abs(e.clientX - p.x) < DRAG_FROM_PX) return;
      p.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    const step = stepPx();
    const dt = Math.max(e.timeStamp - p.lastT, 1);
    p.speed = (e.clientX - p.lastX) / step / dt; // cards per ms
    p.lastX = e.clientX;
    p.lastT = e.timeStamp;
    setPos(p.pos - (e.clientX - p.x) / step);
  }

  function onPointerUp() {
    const p = press.current;
    press.current = null;
    if (!p?.moved) return;
    dragged.current = true;
    setDragging(false);
    // A flick carries on to the next card; otherwise settle on the nearest one.
    setPos((x) => Math.round(x - p.speed * 180));
  }

  function onClickCapture(e: MouseEvent<HTMLElement>) {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!loops) return;
    if (e.key === 'ArrowRight') setPos((x) => Math.round(x) + 1);
    else if (e.key === 'ArrowLeft') setPos((x) => Math.round(x) - 1);
    else return;
    e.preventDefault();
  }

  const center = Math.round(pos);
  const slots = loops ? Array.from({ length: around * 2 + 1 }, (_, i) => center - around + i) : [0];
  return {
    pos,
    center,
    slots,
    dragging,
    /** Card `k mod n` for a slot. */
    index: (k: number) => ((k % n) + n) % n,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture, onKeyDown },
  };
}
