import { Link } from 'react-router';

import { imageSrc } from '../../api/images';
import type { Branch, Membership, MembershipPlan, Pricing, Subscription } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { passLines, tierLines } from '../../shared/lib/plans';
import chevron from '../ui/assets/chevron.svg';
import faq from '../ui/assets/faq.svg';
import history from '../ui/assets/history.svg';
import info from '../ui/assets/info.svg';
import logout from '../ui/assets/logout.svg';
import { Avatar } from '../ui/Avatar';
import { Screen } from '../ui/Screen';
import { ART, Art, u } from '../ui/units';

/**
 * One plan card (Figma "Membership Card"): the badge overflowing its left
 * side, a line, the name and two lines. As drawn, the tier card's line and
 * text sit 1–2 px right of the pass card's (`tier`).
 */
function PlanCard({ badge, size, at, corner, title, lines, empty = false, tier = false }: {
  badge: string | null | undefined;
  size: number;
  at: [number, number];
  corner: number;
  title: string;
  lines: [string, string];
  empty?: boolean;
  tier?: boolean;
}) {
  return (
    <div className="bd-plan-card" style={{ borderTopLeftRadius: u(corner) }}>
      {badge && <img className="bd-plan-badge" src={badge} alt="" style={{ left: u(at[0]), top: u(at[1]), width: u(size), height: u(size) }} />}
      {empty && <span className="bd-plan-none" aria-hidden="true" />}
      <span className="bd-plan-divider" style={{ left: u(tier ? 155 : 153) }} />
      <p className="bd-plan-title" style={{ left: u(tier ? 169 : 168) }}>
        {title}
      </p>
      <p className={tier ? 'bd-plan-lines bd-plan-lines-tier' : 'bd-plan-lines'}>
        {lines[0]}
        {lines[1] && (
          <>
            <br />
            {lines[1]}
          </>
        )}
      </p>
    </div>
  );
}

/** Figma "Settings": the profile, the gamer's membership and pass, the other pages, and logging out. */
export function SettingsScreen() {
  const { user, logout: signOut } = useAuth();
  const branches = useApiQuery<Branch[]>('/branches');
  const memberships = useApiQuery<Membership[]>('/memberships/me');
  const tiers = useApiQuery<MembershipPlan[]>('/membership-plans');
  const subscriptions = useApiQuery<Subscription[]>('/subscriptions/me');
  const pricing = useApiQuery<Pricing>('/pricing');
  if (!user) return null;

  const branch = branches.data?.find((b) => b.id === user.homeBranchId)?.name ?? '';
  const membership = memberships.data?.find((m) => m.status === 'ACTIVE');
  // Without a paid tier the gamer is on the free one (Standard).
  const tier = membership?.membershipPlan ?? tiers.data?.find((t) => t.price === 0);
  const discount = membership?.discountPercentSnapshot ?? tier?.discountPercent ?? 0;
  const pass = subscriptions.data?.find((s) => s.status === 'ACTIVE');

  return (
    <Screen nav="settings">
      <div className="bd-settings">
        <Link to="/account" className="bd-profile-card">
          <span className="bd-profile-card-avatar">
            <Avatar url={user.avatarUrl} size={56} />
          </span>
          <span className="bd-profile-card-name">{user.username}</span>
          <span className="bd-profile-card-branch">{branch}</span>
          <Art className="bd-profile-card-chevron" src={chevron} w={ART.chevron[0]} h={ART.chevron[1]} />
        </Link>

        <div className="bd-settings-head" style={{ marginTop: u(27) }}>
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

        <div className="bd-settings-head" style={{ marginTop: u(36) }}>
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
            <Link to="/plans" className="bd-plan-link">
              <PlanCard badge={null} size={0} at={[0, 0]} corner={45} title="None" lines={['Buy a plan', 'See our offers !']} empty />
            </Link>
          )}
        </div>

        <div className="bd-settings-head" style={{ marginTop: u(24) }}>
          <h2>Other Settings</h2>
        </div>
        <nav className="bd-settings-list">
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

        <button type="button" className="bd-logout" onClick={() => void signOut()}>
          <Art className="bd-logout-icon" src={logout} w={ART.logout[0]} h={ART.logout[1]} />
          Log Out
        </button>
      </div>
    </Screen>
  );
}
