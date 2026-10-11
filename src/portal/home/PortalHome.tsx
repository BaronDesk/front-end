import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import { imageSrc } from '../../api/images';
import type { Game } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import manette from '../ui/assets/manette.svg';
import gamerScribble from '../ui/assets/gamer-scribble.svg';
import { Avatar } from '../ui/Avatar';
import { PlayerBadges } from '../ui/PlayerBadges';
import { Screen } from '../ui/Screen';
import { XpBar } from '../ui/XpBar';

/** Figma "Home": who the gamer is, the game collection, and the way to Bookings and Events. */
export function PortalHome() {
  const { user } = useAuth();
  const games = useApiQuery<Game[]>('/api/v1/games');
  // The games with a poster first: the cards are made for them.
  const collection = (games.data ?? [])
    .filter((g) => g.enabled)
    .sort((a, b) => Number(!a.iconUrl) - Number(!b.iconUrl) || a.sortOrder - b.sortOrder);

  // As in Figma, the collection opens on its middle card, a neighbour peeking in on each side.
  const cards = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const middle = cards.current?.children[Math.floor((collection.length - 1) / 2)] as HTMLElement | undefined;
    middle?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [collection.length]);

  return (
    <Screen nav="home">
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

      <div className="bd-games" ref={cards} aria-label="Our collection">
        {collection.map((game) => {
          const poster = imageSrc(game.iconUrl);
          return (
            <div key={game.id} className="bd-game">
              {poster ? <img src={poster} alt={game.name} loading="lazy" /> : <span className="bd-game-name">{game.name}</span>}
            </div>
          );
        })}
      </div>

      <nav className="bd-home-buttons">
        <Link to="/book" className="bd-button-big">
          <img className="bd-button-doodle bd-doodle-manette" src={manette} alt="" />
          <span>Bookings</span>
        </Link>
        <Link to="/events" className="bd-button-big">
          <img className="bd-button-doodle bd-doodle-scribble" src={gamerScribble} alt="" />
          <span>Events</span>
        </Link>
      </nav>
    </Screen>
  );
}
