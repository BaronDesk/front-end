import { useEffect, useState } from 'react';

import { u } from './units';

/** Where a badge's drawing sits in its square picture, as fractions (0..1). */
interface Shape {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const FULL: Shape = { left: 0, top: 0, right: 1, bottom: 1 };
const shapes = new Map<string, Promise<Shape>>();

/**
 * Finds the visible part of a badge (its non-transparent pixels). Badges are
 * drawn with different empty margins: a rank fills about 58% of its square, a
 * pass 90%, so placing the squares side by side leaves uneven gaps.
 */
function measureShape(src: string): Promise<Shape> {
  let shape = shapes.get(src);
  if (!shape) {
    shape = new Promise<Shape>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const n = 96;
          const canvas = document.createElement('canvas');
          canvas.width = n;
          canvas.height = n;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(FULL);
          ctx.drawImage(img, 0, 0, n, n);
          const { data } = ctx.getImageData(0, 0, n, n);
          let left = n, top = n, right = -1, bottom = -1;
          for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
              if (data[(y * n + x) * 4 + 3] > 24) {
                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
              }
            }
          }
          resolve(right < 0 ? FULL : { left: left / n, top: top / n, right: (right + 1) / n, bottom: (bottom + 1) / n });
        } catch {
          resolve(FULL); // a picture the canvas may not read: use it whole
        }
      };
      img.onerror = () => resolve(FULL);
      img.src = src;
    });
    shapes.set(src, shape);
  }
  return shape;
}

/**
 * A badge cropped to its drawing (Figma px):
 * - `height`: the drawing is this tall, whatever the picture (header badges look the same size);
 * - `box`: the picture is this square, cropped at its sides only (the Profile rows, as drawn).
 * `dim`: a badge not reached or not owned yet, faded as in Figma (30%).
 */
export function BadgeImage({ src, name, height, box, dim = false }: { src: string; name: string; height?: number; box?: number; dim?: boolean }) {
  const [shape, setShape] = useState<Shape | null>(null);
  useEffect(() => {
    let live = true;
    measureShape(src).then((s) => live && setShape(s));
    return () => {
      live = false;
    };
  }, [src]);

  const s = shape ?? FULL;
  const side = box ?? (height ?? 20) / (s.bottom - s.top);
  const top = box ? 0 : s.top;
  const visibleHeight = box ? box : side * (s.bottom - s.top);
  return (
    <span
      className="bd-badge"
      title={name}
      style={{ width: u(side * (s.right - s.left)), height: u(visibleHeight), visibility: shape ? 'visible' : 'hidden', opacity: dim ? 0.3 : undefined }}
    >
      <img src={src} alt={name} style={{ left: u(-side * s.left), top: u(-side * top), width: u(side), height: u(side) }} />
    </span>
  );
}
