import { Link } from 'react-router';

import { useAuth } from '../../../../providers/AuthProvider';
import { useActivePlans, useGames } from '../../../../hooks/queries';
import manette from '../../../../components/assets/manette.svg';
import gamerScribble from '../../../../components/assets/gamer-scribble.svg';
import { Avatar } from '../../../../components/primitives/Avatar';
import { PlayerBadges } from '../../../../components/composites/PlayerBadges';
import { ART, Art } from '../../../../components/primitives/Art';
import { XpBar } from '../../../../components/composites/XpBar';
import { GameCarousel } from '../../../../components/composites/GameCarousel';
import { cx } from '../../../../lib/cx';
import styles from './HomePage.module.css';

/** Figma "Home": who the gamer is, the game collection, and the way to Bookings and Events. */
export function HomePage() {
  const { user } = useAuth();
  const plans = useActivePlans();
  // Gamers get only the enabled games offered somewhere (the public shape, no `enabled`).
  const games = useGames();
  // The games with a poster first: the cards are made for them.
  const collection = [...(games.data ?? [])].sort((a, b) => Number(!a.iconUrl) - Number(!b.iconUrl) || a.sortOrder - b.sortOrder);

  return (
    <>
      <div className={styles.root}>
        {user && (
          <header className={styles.head}>
            <Avatar className={styles.avatar} url={user.avatarUrl} size={65} />
            <p className={styles.name}>{user.username}</p>
            <PlayerBadges className={styles.badges} user={user} tier={plans.tier} pass={plans.pass} />
            <XpBar className={styles.xp} user={user} />
          </header>
        )}

        <section className={styles.hero}>
          <h1 className={styles.title}>
            Conquer
            <br />
            the
            <br />
            Game !
          </h1>
          <h2 className={styles.collection}>Our Collection</h2>
        </section>

        {/* On a taller phone the cards and buttons sit in the middle of the space left. */}
        <div className={styles.main}>
          {collection.length > 0 && <GameCarousel key={collection.length} games={collection} />}

          <nav className={styles.buttons}>
            <Link to="/book" className={styles.buttonBig}>
              <Art className={cx(styles.buttonDoodle, styles.doodleManette)} src={manette} w={ART.manette[0]} h={ART.manette[1]} />
              <span>Bookings</span>
            </Link>
            <Link to="/events" className={styles.buttonBig}>
              <Art className={cx(styles.buttonDoodle, styles.doodleScribble)} src={gamerScribble} w={ART.gamerScribble[0]} h={ART.gamerScribble[1]} />
              <span>Events</span>
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
