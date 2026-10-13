import { imageSrc } from '../../lib/images';
import type { PublicUser } from '../../core/api-types';
import { BadgeImage } from '../primitives/BadgeImage';
import { u } from '../primitives/Art';
import { cx } from '../../lib/cx';
import styles from './PlayerBadges.module.css';

/** A plan's name and badge drawing. */
type Badge = { name: string; badgeUrl?: string | null };

/**
 * The gamer's badges, left to right: their rank, their membership tier and
 * their pass (missing ones left out). As in Figma, the drawings are about
 * 20 px tall and 4 px apart on Home; `height` and `gap` change that.
 */
export function PlayerBadges({
  user,
  tier,
  pass,
  height = 20,
  gap = 4,
  className,
}: {
  user: Pick<PublicUser, 'rank'>;
  tier?: Badge | null;
  pass?: Badge | null;
  height?: number;
  gap?: number;
  className?: string;
}) {

  const badges = [
    { key: 'rank', name: user.rank?.name ?? '', url: user.rank?.badgeUrl },
    { key: 'tier', name: tier?.name ?? '', url: tier?.badgeUrl },
    { key: 'pass', name: pass?.name ?? '', url: pass?.badgeUrl },
  ];

  return (
    <div className={cx(styles.root, className)} style={{ gap: u(gap) }}>
      {badges.map((b) => {
        const src = imageSrc(b.url);
        return src ? <BadgeImage key={b.key} src={src} name={b.name} height={height} /> : null;
      })}
    </div>
  );
}
