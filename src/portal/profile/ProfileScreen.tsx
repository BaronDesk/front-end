import { Link } from 'react-router';

import { imageSrc } from '../../api/images';
import type { Membership, MembershipPlan, Rank, Wallet } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { groupThousands } from '../../shared/lib/format';
import coin from '../ui/assets/coin.png';
import profileBg from '../ui/assets/profile-bg.svg';
import walletFront from '../ui/assets/wallet-front.png';
import { Avatar } from '../ui/Avatar';
import { BadgeImage } from '../ui/BadgeImage';
import { Screen } from '../ui/Screen';
import { ART, Art, u } from '../ui/units';
import { xpProgress } from '../ui/XpBar';

/**
 * The three coins tucked in the wallet, as drawn: center (Figma px), size and
 * tilt. Figma places a rotated layer by the corner it turns around; these are
 * the centers that gives.
 */
const COINS = [
  { x: 128.97, y: 331.2, size: 86.069, turn: 17.47 },
  { x: 228.0, y: 332.0, size: 64.908, turn: -111.25 },
  { x: 180.48, y: 326.03, size: 119.975, turn: -15.75 },
];

/** Figma "Profile": the gamer, their XP, their coins, the ranks reached and the membership tiers. */
export function ProfileScreen() {
  const { user } = useAuth();
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const ranks = useApiQuery<Rank[]>('/ranks');
  const tiers = useApiQuery<MembershipPlan[]>('/membership-plans');
  const memberships = useApiQuery<Membership[]>('/memberships/me');
  if (!user) return null;

  const xp = user.xp ?? 0;
  // Without a paid tier the gamer is on the free one (Standard, price 0).
  const tierList = [...(tiers.data ?? [])].sort((a, b) => a.price - b.price);
  const activeTierId = memberships.data?.find((m) => m.status === 'ACTIVE')?.membershipPlanId ?? tierList.find((t) => t.price === 0)?.id;
  const fill = Math.max(82, xpProgress(user) * 285);

  return (
    <Screen nav="profile">
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

        <section className="bd-wallet" aria-label="Wallet">
          <span className="bd-wallet-back" />
          {COINS.map((c, i) => (
            <span key={i} className="bd-wallet-coin" style={{ left: u(c.x - c.size / 2), top: u(c.y - c.size / 2), width: u(c.size), height: u(c.size) }}>
              <img src={coin} alt="" style={{ width: u(c.size), height: u(c.size), transform: `rotate(${c.turn}deg)` }} />
            </span>
          ))}
          <Art className="bd-wallet-front" src={walletFront} w={ART.walletFront[0]} h={ART.walletFront[1]} />
          <p className="bd-wallet-label">Total Balance</p>
          <p className="bd-wallet-balance">{wallet.data ? groupThousands(wallet.data.balance) : '…'}</p>
        </section>

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
      </div>
    </Screen>
  );
}
