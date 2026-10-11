import { imageSrc } from '../../api/images';
import type { Membership, PublicUser, Subscription } from '../../api/types';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { BadgeImage } from './BadgeImage';
import { u } from './units';

/**
 * The gamer's badges, left to right: their rank, their membership tier and
 * their pass (missing ones left out). As in Figma, the drawings are about
 * 20 px tall and 4 px apart on Home; `height` and `gap` change that.
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
        return src ? <BadgeImage key={b.key} src={src} name={b.name} height={height} /> : null;
      })}
    </div>
  );
}
