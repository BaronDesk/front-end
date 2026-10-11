import type { CSSProperties } from 'react';
import { Link } from 'react-router';

import bookingIcon from './assets/booking-icon.svg';
import homeIcon from './assets/home-icon.svg';
import navBump from './assets/nav-bump.svg';
import settingsIcon from './assets/settings-icon.svg';
import userIcon from './assets/user-icon.svg';

export type NavKey = 'home' | 'book' | 'profile' | 'settings';

const ITEMS: Record<NavKey, { to: string; label: string; icon: string }> = {
  home: { to: '/', label: 'Home', icon: homeIcon },
  book: { to: '/book', label: 'Bookings', icon: bookingIcon },
  profile: { to: '/profile', label: 'Profile', icon: userIcon },
  settings: { to: '/settings', label: 'Settings', icon: settingsIcon },
};

const ORDER: NavKey[] = ['home', 'book', 'profile', 'settings'];

/**
 * Where each item's center sits on the 360 px Figma screen, for each active
 * item: the icons make room around the raised circle differently per screen.
 */
const LAYOUT: Record<NavKey, Record<NavKey, number>> = {
  home: { home: 74, book: 167.5, profile: 242, settings: 319 },
  book: { home: 48, book: 148, profile: 244, settings: 319 },
  profile: { home: 47.3, book: 121.5, profile: 224, settings: 319 },
  settings: { home: 48.3, book: 118.5, profile: 196.5, settings: 287 },
};

const SCREEN = 360;

/** The black bar at the bottom of every screen; the current page's icon rises into a circle. */
export function BottomNav({ active }: { active: NavKey }) {
  const at = LAYOUT[active];
  const style = {
    '--bd-bump': `url("${navBump}")`,
    // The bar is as wide as the column (at most 430 px): the bump follows the active circle.
    '--bd-active-x': `calc(${at[active] / SCREEN} * min(100vw, var(--bd-column)))`,
  } as CSSProperties;

  return (
    <nav className="bd-nav" style={style} aria-label="Main">
      <div className="bd-nav-bar" />
      {ORDER.map((key) => {
        const item = ITEMS[key];
        return (
          <Link
            key={key}
            to={item.to}
            className={key === active ? 'bd-nav-active' : 'bd-nav-item'}
            style={{ left: `${(at[key] / SCREEN) * 100}%` }}
            aria-label={item.label}
            aria-current={key === active ? 'page' : undefined}
          >
            <img src={item.icon} alt="" />
          </Link>
        );
      })}
    </nav>
  );
}
