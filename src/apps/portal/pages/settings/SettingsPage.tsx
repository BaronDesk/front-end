import { Link } from 'react-router';

import { imageSrc } from '../../../../lib/images';
import { useAuth } from '../../../../providers/AuthProvider';
import { useBranches, useMembershipPlans, useMyMemberships, useMySubscriptions, usePricing } from '../../../../hooks/queries';
import { passLines, tierLines } from '../../../../domain/plans';
import chevron from '../../../../components/assets/chevron.svg';
import faq from '../../../../components/assets/faq.svg';
import history from '../../../../components/assets/history.svg';
import info from '../../../../components/assets/info.svg';
import logout from '../../../../components/assets/logout.svg';
import { Avatar } from '../../../../components/primitives/Avatar';
import { PlanCard } from '../../../../components/composites/PlanCard';
import { ART, Art, u } from '../../../../components/primitives/Art';
import { Button } from '../../../../components/primitives/Button';
import styles from './SettingsPage.module.css';

/** Settings: the profile, the gamer's membership and pass, the other pages, and logging out. */
export function SettingsPage() {
  const { user, logout: signOut } = useAuth();
  const branches = useBranches();
  const memberships = useMyMemberships();
  const tiers = useMembershipPlans();
  const subscriptions = useMySubscriptions();
  const pricing = usePricing();
  if (!user) return null;

  const branch = branches.data?.find((b) => b.id === user.homeBranchId)?.name ?? '';
  const membership = memberships.data?.find((m) => m.status === 'ACTIVE');
  // Without a paid tier the gamer is on the free one (Standard).
  const tier = membership?.membershipPlan ?? tiers.data?.find((t) => t.price === 0);
  const discount = membership?.discountPercentSnapshot ?? tier?.discountPercent ?? 0;
  const pass = subscriptions.data?.find((s) => s.status === 'ACTIVE');

  return (
    <>
      <div className={styles.root}>
        <Link to="/account" className={styles.profileCard}>
          <span className={styles.profileCardAvatar}>
            <Avatar url={user.avatarUrl} size={56} />
          </span>
          <span className={styles.profileCardName}>{user.username}</span>
          <span className={styles.profileCardBranch}>{branch}</span>
          <Art className={styles.profileCardChevron} src={chevron} w={ART.chevron[0]} h={ART.chevron[1]} />
        </Link>

        <div className={styles.head} style={{ marginTop: u(27) }}>
          <h2>Membership</h2>
          <Link to="/plans">See All</Link>
        </div>
        <div style={{ marginTop: u(20) }}>
          <PlanCard
            badge={imageSrc(tier?.badgeUrl)}
            size={184}
            at={[-33, -31]}
            corner={40}
            tier
            title={tier?.name ?? '…'}
            lines={tierLines(discount, pricing.data?.bookingRate ?? null)}
          />
        </div>

        <div className={styles.head} style={{ marginTop: u(36) }}>
          <h2>Plans</h2>
          <Link to="/plans">See All</Link>
        </div>
        <div style={{ marginTop: u(20) }}>
          {pass ? (
            <PlanCard
              badge={imageSrc(pass.subscriptionPlan?.badgeUrl)}
              size={179}
              at={[-34, -40]}
              corner={45}
              title={pass.subscriptionPlan?.name ?? 'Pass'}
              lines={passLines(pass.benefitsSnapshot ?? pass.subscriptionPlan?.benefits)}
            />
          ) : (
            <Link to="/plans" className={styles.planLink}>
              <PlanCard badge={null} size={0} at={[0, 0]} corner={45} title="None" lines={['Buy a plan', 'See our offers !']} empty />
            </Link>
          )}
        </div>

        <div className={styles.head} style={{ marginTop: u(24) }}>
          <h2>Other Settings</h2>
        </div>
        <nav className={styles.list}>
          <Link to="/history">
            <Art src={history} w={ART.history[0]} h={ART.history[1]} />
            Sessions History
          </Link>
          <Link to="/terms">
            <Art src={info} w={ART.info[0]} h={ART.info[1]} />
            Terms Of Service
          </Link>
          <Link to="/faq">
            <Art src={faq} w={ART.faq[0]} h={ART.faq[1]} />
            FAQ
          </Link>
        </nav>

        <Button variant="danger" className={styles.logout} icon={<Art className={styles.logoutIcon} src={logout} w={ART.logout[0]} h={ART.logout[1]} />} onClick={() => void signOut()}>
          Log Out
        </Button>
      </div>
    </>
  );
}
