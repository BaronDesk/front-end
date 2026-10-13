import { Link } from 'react-router';

import { imageSrc } from '../../../../lib/images';
import { useAuth } from '../../../../providers/AuthProvider';
import { useMembershipPlans, useMyMemberships, useMySubscriptions, useMyWallet, usePasses, useRanks } from '../../../../hooks/queries';
import profileBg from '../../../../components/assets/profile-bg.svg';
import { Avatar } from '../../../../components/primitives/Avatar';
import { BadgeImage } from '../../../../components/primitives/BadgeImage';
import { ART, Art, u } from '../../../../components/primitives/Art';
import { WalletCard } from '../../../../components/composites/WalletCard';
import { xpProgress } from '../../../../domain/xp';
import { cx } from '../../../../lib/cx';
import styles from './ProfilePage.module.css';

/**
 * Profile: the gamer, their XP, their coins, the ranks reached and the
 * membership tiers; then the passes (Plans), drawn like the tiers.
 */
export function ProfilePage() {
  const { user } = useAuth();
  const wallet = useMyWallet();
  const ranks = useRanks();
  const tiers = useMembershipPlans();
  const memberships = useMyMemberships();
  const passes = usePasses();
  const subscriptions = useMySubscriptions();
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
      <div className={styles.root}>
        <Art className={styles.bg} src={profileBg} w={ART.profileBg[0]} h={ART.profileBg[1]} />
        <span className={styles.avatar}>
          <Avatar url={user.avatarUrl} size={122} />
        </span>
        <h1 className={styles.name}>{user.username}</h1>
        <p className={styles.rank}>{user.rank?.name ?? ''}</p>

        <div className={styles.xp} role="img" aria-label={`${xp} XP${user.nextRank ? `, ${user.nextRank.name} at ${user.nextRank.minXp} XP` : ''}`}>
          <span className={styles.xpFill} style={{ width: u(fill) }} />
          <span className={styles.xpValue}>{xp}XP</span>
          <span className={styles.xpGoal}>{user.nextRank ? `${user.nextRank.minXp - 1}XP` : 'MAX'}</span>
        </div>

        <Link to="/wallet" className={styles.wallet}>
          <WalletCard balance={wallet.data?.balance} />
        </Link>

        <h2 className={cx(styles.section, styles.levelsTitle)}>Levels &amp; Achievements</h2>
        <div className={cx(styles.row, styles.levels)}>
          {(ranks.data ?? []).map((r) => {
            const src = imageSrc(r.badgeUrl);
            const reached = r.minXp <= xp;
            return src ? <BadgeImage key={r.id} src={src} name={`${r.name}${reached ? '' : ` (${r.minXp} XP)`}`} box={132} dim={!reached} /> : null;
          })}
        </div>

        <h2 className={cx(styles.section, styles.tiersTitle)}>Memberships</h2>
        <div className={cx(styles.row, styles.tiers)}>
          {tierList.map((t) => {
            const src = imageSrc(t.badgeUrl);
            return src ? (
              <Link key={t.id} to="/plans" aria-label={`${t.name}${t.id === activeTierId ? ' (yours)' : ''}`}>
                <BadgeImage src={src} name={t.name} box={119} dim={t.id !== activeTierId} />
              </Link>
            ) : null;
          })}
        </div>

        <h2 className={cx(styles.section, styles.plansTitle)}>Plans</h2>
        <div className={cx(styles.row, styles.plans)}>
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
