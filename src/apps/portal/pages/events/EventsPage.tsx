import { useRef, useState } from 'react';

import type { Tournament } from '../../../../core/api-types';
import { useTournaments } from '../../../../hooks/queries';
import { filterTournaments, TOURNAMENT_FILTERS } from '../../../../domain/tournaments';
import { u } from '../../../../components/primitives/Art';
import { PageTitle } from '../../../../components/primitives/PageTitle';
import { useRing } from '../../../../components/composites/useRing';
import { cx } from '../../../../lib/cx';
import { TournamentCard } from '../../../../components/composites/TournamentCard';
import { cardAction } from '../../../../domain/tournaments';
import { NextMatchCard, PlayerHeader } from './TournamentParts';
import styles from './EventsPage.module.css';

/** A card and the gap after it, in design px (303 + 14): the next card peeks in on each side. */
const STEP = 317;

/** The tournament cards as an endless ring, like the game collection on Home: drag them or use the arrow keys. */
function TournamentCarousel({ tournaments }: { tournaments: Tournament[] }) {
  const box = useRef<HTMLDivElement>(null);
  const stepPx = () => {
    const card = box.current?.querySelector<HTMLElement>(`.${styles.slide}`);
    return card ? (card.offsetWidth * STEP) / 303 : STEP;
  };
  const ring = useRing(tournaments.length, { around: 1, stepPx });

  return (
    <div
      ref={box}
      className={cx(styles.carousel, ring.dragging && styles.dragging)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Tournaments"
      tabIndex={0}
      {...ring.handlers}
    >
      {ring.slots.map((k) => {
        const away = k !== ring.center;
        const t = tournaments[ring.index(k)];
        return (
          <div key={k} className={styles.slide} style={{ transform: `translateX(${u((k - ring.pos) * STEP)})` }} aria-hidden={away} inert={away}>
            <TournamentCard tournament={t} action={{ to: `/events/${t.id}`, label: cardAction(t) }} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Events: the branch tournaments. The gamer's next match first (PC and PIN,
 * a blinking dot), the filter chips, then the tournaments as large cards to
 * slide through. A card's buttons open the tournament or its bracket. Sample
 * data until the backend has tournaments.
 */
export function EventsPage() {
  const tournaments = useTournaments().data;
  const [filter, setFilter] = useState('all');
  const shown = filterTournaments(tournaments, filter);
  const mine = tournaments.find((t) => t.myNextMatch);

  return (
    <div className={styles.root}>
      <PlayerHeader />

      <PageTitle>Tournaments</PageTitle>

      {mine && (
        <div className={styles.next}>
          <NextMatchCard tournament={mine} />
        </div>
      )}

      <div className={styles.filters} role="group" aria-label="Show tournaments">
        {TOURNAMENT_FILTERS.map((f) => (
          <button key={f.key} type="button" className={cx(styles.filter, filter === f.key && styles.filterOn)} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length > 0 ? <TournamentCarousel key={filter} tournaments={shown} /> : <p className={styles.none}>No tournament here right now.</p>}
    </div>
  );
}
