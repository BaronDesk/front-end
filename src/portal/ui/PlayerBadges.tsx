import { useEffect, useState } from 'react';

import { imageSrc } from '../../api/images';
import type { Membership, PublicUser, Subscription } from '../../api/types';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
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
 * One badge, cropped to its drawing and sized so the drawing is `height`
 * tall (Figma px): every badge then looks the same size.
 */
function Badge({ src, name, height }: { src: string; name: string; height: number }) {
  const [shape, setShape] = useState<Shape | null>(null);
  useEffect(() => {
    let live = true;
    measureShape(src).then((s) => live && setShape(s));
    return () => {
      live = false;
    };
  }, [src]);

  const s = shape ?? FULL;
  const side = height / (s.bottom - s.top);
  return (
    <span
      className="bd-badge"
      title={name}
      style={{ width: u(side * (s.right - s.left)), height: u(height), visibility: shape ? 'visible' : 'hidden' }}
    >
      <img src={src} alt={name} style={{ left: u(-side * s.left), top: u(-side * s.top), width: u(side), height: u(side) }} />
    </span>
  );
}

/**
 * The gamer's badges, left to right: their rank, their membership tier and
 * their pass (missing ones left out). As in Figma, the drawings are about
 * 20 px tall and 4 px apart; `height` and `gap` change that.
 */
export function PlayerBadges({ user, height = 20, gap = 4 }: { user: PublicUser; height?: number; gap?: number }) {
  const memberships = useApiQuery<Membership[]>('/memberships/me');
  const subscriptions = useApiQuery<Subscription[]>('/subscriptions/me');
  const tier = memberships.data?.find((m) => m.status === 'ACTIVE')?.membershipPlan;
  const pass = subscriptions.data?.find((s) => s.status === 'ACTIVE')?.subscriptionPlan;

  const badges = [
    { key: 'rank', name: user.rank?.name ?? '', url: user.rank?.badgeUrl },
    { key: 'tier', name: tier?.name ?? '', url: tier?.badgeUrl },
    { key: 'pass', name: pass?.name ?? '', url: pass?.badgeUrl },
  ];

  return (
    <div className="bd-badges" style={{ gap: u(gap) }}>
      {badges.map((b) => {
        const src = imageSrc(b.url);
        return src ? <Badge key={b.key} src={src} name={b.name} height={height} /> : null;
      })}
    </div>
  );
}
