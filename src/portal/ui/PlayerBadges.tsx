import { imageSrc } from '../../api/images';
import type { Membership, PublicUser, Subscription } from '../../api/types';
import { useApiQuery } from '../../shared/hooks/useApiQuery';

interface Badge {
  key: string;
  name: string;
  url: string | null | undefined;
  size: number;
}

/**
 * The gamer's badges, left to right: their rank, their membership tier and
 * their pass, as in Figma (30, 27 and 30 px at 360 px). Missing ones are left out.
 */
export function PlayerBadges({ user, scale = 1 }: { user: PublicUser; scale?: number }) {
  const memberships = useApiQuery<Membership[]>('/memberships/me');
  const subscriptions = useApiQuery<Subscription[]>('/subscriptions/me');
  const tier = memberships.data?.find((m) => m.status === 'ACTIVE')?.membershipPlan;
  const pass = subscriptions.data?.find((s) => s.status === 'ACTIVE')?.subscriptionPlan;

  const badges: Badge[] = [
    { key: 'rank', name: user.rank?.name ?? '', url: user.rank?.badgeUrl, size: 30 },
    { key: 'tier', name: tier?.name ?? '', url: tier?.badgeUrl, size: 27 },
    { key: 'pass', name: pass?.name ?? '', url: pass?.badgeUrl, size: 30 },
  ];

  return (
    <div className="bd-badges">
      {badges.map((b) => {
        const src = imageSrc(b.url);
        return src ? <img key={b.key} src={src} alt={b.name} title={b.name} width={b.size * scale} height={b.size * scale} /> : null;
      })}
    </div>
  );
}
