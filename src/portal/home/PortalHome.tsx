import { Link } from 'react-router';

import type { PublicGame } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import manette from '../ui/assets/manette.svg';
import gamerScribble from '../ui/assets/gamer-scribble.svg';
import { Avatar } from '../ui/Avatar';
import { PlayerBadges } from '../ui/PlayerBadges';
import { ART, Art } from '../ui/units';
import { XpBar } from '../ui/XpBar';
import { GameCarousel } from './GameCarousel';

/** Figma "Home": who the gamer is, the game collection, and the way to Bookings and Events. */
export function PortalHome() {
  const { user } = useAuth();
  // Gamers get only the enabled games offered somewhere (the public shape, no `enabled`).
  const games = useApiQuery<PublicGame[]>('/api/v1/games');
  // The games with a poster first: the cards are made for them.
  const collection = [...(games.data ?? [])].sort((a, b) => Number(!a.iconUrl) - Number(!b.iconUrl) || a.sortOrder - b.sortOrder);

  return (
    <>
      <div className="bd-home">
        {user && (
          <header className="bd-home-head">
            <Avatar url={user.avatarUrl} size={65} />
            <p className="bd-home-name">{user.username}</p>
            <PlayerBadges user={user} />
            <XpBar user={user} />
          </header>
        )}

        <section className="bd-home-hero">
          <h1 className="bd-home-title">
            Conquer
            <br />
            the
            <br />
            Game !
          </h1>
          <h2 className="bd-home-collection">Our Collection</h2>
        </section>

        {/* On a taller phone the cards and buttons sit in the middle of the space left. */}
        <div className="bd-home-main">
          {collection.length > 0 && <GameCarousel key={collection.length} games={collection} />}

          <nav className="bd-home-buttons">
            <Link to="/book" className="bd-button-big">
              <Art className="bd-button-doodle bd-doodle-manette" src={manette} w={ART.manette[0]} h={ART.manette[1]} />
              <span>Bookings</span>
            </Link>
            <Link to="/events" className="bd-button-big">
              <Art className="bd-button-doodle bd-doodle-scribble" src={gamerScribble} w={ART.gamerScribble[0]} h={ART.gamerScribble[1]} />
              <span>Events</span>
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
