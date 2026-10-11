import { Link } from 'react-router';

import { imageSrc } from '../../api/images';
import type { Membership, MembershipPlan, Rank, Subscription, SubscriptionPlan, Wallet } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import profileBg from '../ui/assets/profile-bg.svg';
import { Avatar } from '../ui/Avatar';
import { BadgeImage } from '../ui/BadgeImage';
import { ART, Art, u } from '../ui/units';
import { WalletCard } from '../ui/WalletCard';
import { xpProgress } from '../ui/XpBar';

/**
 * Figma "Profile": the gamer, their XP, their coins, the ranks reached and the
 * membership tiers; then the passes (Plans, not in Figma: drawn like the tiers).
 */
export function ProfileScreen() {
  const { user } = useAuth();
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const ranks = useApiQuery<Rank[]>('/ranks');
  const tiers = useApiQuery<MembershipPlan[]>('/membership-plans');
  const memberships = useApiQuery<Membership[]>('/memberships/me');
  const passes = useApiQuery<SubscriptionPlan[]>('/subscription-plans');
  const subscriptions = useApiQuery<Subscription[]>('/subscriptions/me');
  if (!user) return null;

  const xp = user.xp ?? 0;
  // Without a paid tier the gamer is on the free one (Standard, price 0).
  const tierList = [...(tiers.data ?? [])].sort((a, b) => a.price - b.price);
  const activeTierId = memberships.data?.find((m) => m.status === 'ACTIVE')?.membershipPlanId ?? tierList.find((t) => t.price === 0)?.id;
  const fill = Math.max(82, xpProgress(user) * 285);
  const passList = [...(passes.data ?? [])].sort((a, b) => a.price - b.price);
  const ownedPasses = new Set((subscriptions.data ?? []).filter((s) => s.status === 'ACTIVE').map((s) => s.subscriptionPlanId));

  return (
    <>
      <div className="bd-profile">
        <Art className="bd-profile-bg" src={profileBg} w={ART.profileBg[0]} h={ART.profileBg[1]} />
        <span className="bd-profile-avatar">
          <Avatar url={user.avatarUrl} size={122} />
        </span>
        <h1 className="bd-profile-name">{user.username}</h1>
        <p className="bd-profile-rank">{user.rank?.name ?? ''}</p>

        <div className="bd-profile-xp" role="img" aria-label={`${xp} XP${user.nextRank ? `, ${user.nextRank.name} at ${user.nextRank.minXp} XP` : ''}`}>
          <span className="bd-profile-xp-fill" style={{ width: u(fill) }} />
          <span className="bd-profile-xp-value">{xp}XP</span>
          <span className="bd-profile-xp-goal">{user.nextRank ? `${user.nextRank.minXp - 1}XP` : 'MAX'}</span>
        </div>

        <Link to="/wallet" className="bd-profile-wallet">
          <WalletCard balance={wallet.data?.balance} />
        </Link>

        <h2 className="bd-profile-section bd-profile-levels-title">Levels &amp; Achievements</h2>
        <div className="bd-profile-row bd-profile-levels">
          {(ranks.data ?? []).map((r) => {
            const src = imageSrc(r.badgeUrl);
            const reached = r.minXp <= xp;
            return src ? <BadgeImage key={r.id} src={src} name={`${r.name}${reached ? '' : ` (${r.minXp} XP)`}`} box={132} dim={!reached} /> : null;
          })}
        </div>

        <h2 className="bd-profile-section bd-profile-tiers-title">Memberships</h2>
        <div className="bd-profile-row bd-profile-tiers">
          {tierList.map((t) => {
            const src = imageSrc(t.badgeUrl);
            return src ? (
              <Link key={t.id} to="/plans" aria-label={`${t.name}${t.id === activeTierId ? ' (yours)' : ''}`}>
                <BadgeImage src={src} name={t.name} box={119} dim={t.id !== activeTierId} />
              </Link>
            ) : null;
          })}
        </div>

        <h2 className="bd-profile-section bd-profile-plans-title">Plans</h2>
        <div className="bd-profile-row bd-profile-plans">
          {passList.map((p) => {
            const src = imageSrc(p.badgeUrl);
            const owned = ownedPasses.has(p.id);
            return src ? (
              <Link key={p.id} to="/plans" aria-label={`${p.name}${owned ? ' (yours)' : ''}`}>
                <BadgeImage src={src} name={p.name} box={119} dim={!owned} />
              </Link>
            ) : null;
          })}
        </div>
      </div>
    </>
  );
}
