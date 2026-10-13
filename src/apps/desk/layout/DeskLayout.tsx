import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../../../providers/AuthProvider';
import { hasRole, ROLE_LABEL } from '../../../core/auth/roles';
import { cx } from '../../../lib/cx';
import largeLogo from '../../../components/assets/large-logo.svg';
import logoutIcon from '../../../components/assets/logout.svg';
import { ART, Art } from '../../../components/primitives/Art';
import { Avatar } from '../../../components/primitives/Avatar';
import { Button, ButtonLink } from '../../../components/primitives/Button';
import { PageErrorBoundary } from '../../../components/layout/PageErrorBoundary';
import { ConnectionBanner, LiveTag } from '../components/ConnectionBanner';
import { AlertBanner } from '../components/AlertBanner';
import { AlertFeedProvider, useAlertFeed } from '../providers/AlertFeedContext';
import { BranchProvider, BranchSwitcher, useBranchScope } from '../providers/BranchContext';
import { DESK_MENU } from '../menu';
import styles from './DeskLayout.module.css';

export function DeskLayout() {
  return (
    <BranchProvider>
      <AlertFeedProvider>
        <DeskShell />
      </AlertFeedProvider>
    </BranchProvider>
  );
}

/**
 * The desk in the portal's design: a sidebar card (logo, the menu for the
 * user's role, who is logged in), a slim header (live updates, HQ's branch)
 * and the page.
 */
function DeskShell() {
  const { user, logout } = useAuth();
  const { openCount } = useAlertFeed();
  const { branchId } = useBranchScope();
  const menu = DESK_MENU.filter((item) => !item.minRole || hasRole(user, item.minRole));

  return (
    <div className={cx('bd-desk', styles.shell)}>
      <aside className={styles.side}>
        <div className={styles.panel}>
          <NavLink to="/" className={styles.logo} aria-label="BaronDesk home">
            <Art src={largeLogo} w={ART.largeLogo[0] * 0.8} h={ART.largeLogo[1] * 0.8} alt="BaronDesk" />
          </NavLink>
          <nav aria-label="Menu">
            <ul className={styles.menu}>
              {menu.map((item) => (
                <li key={item.path}>
                  <NavLink to={item.path} className={({ isActive }) => cx(styles.item, isActive && styles.active)}>
                    {item.label}
                    {item.path === '/alerts' && openCount > 0 && <span className={styles.count}>{openCount}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          {user && (
            <div className={styles.user}>
              <div className={styles.who}>
                <Avatar url={user.avatarUrl} size={38} />
                <div>
                  <p className={styles.name}>{user.username}</p>
                  <p className={styles.role}>{ROLE_LABEL[user.role]}</p>
                </div>
              </div>
              <div className={styles.userActions}>
                <ButtonLink to="/account" variant="outline" size="sm">
                  Password
                </ButtonLink>
                <Button variant="danger" size="sm" icon={<Art className={styles.logoutIcon} src={logoutIcon} w={14} h={14} />} onClick={() => void logout()}>
                  Log Out
                </Button>
              </div>
            </div>
          )}
          <p className={styles.footer}>BaronDesk &copy; 2026 &middot; v0.1</p>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <LiveTag />
          <div className={styles.branch}>
            <BranchSwitcher />
          </div>
        </header>
        <ConnectionBanner />
        <AlertBanner />
        <div className={styles.page}>
          {/* A new branch starts every page fresh: lists, forms and selections. */}
          <PageErrorBoundary>
            <Outlet key={branchId ?? 'all'} />
          </PageErrorBoundary>
        </div>
      </main>
    </div>
  );
}
