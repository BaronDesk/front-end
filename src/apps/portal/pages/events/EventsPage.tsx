import { useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../../../../providers/AuthProvider';
import { useActivePlans, useMyWallet, useTournaments } from '../../../../hooks/queries';
import { champion, filterTournaments, formatText, placesText, TOURNAMENT_FILTERS } from '../../../../domain/tournaments';
import { weekdayDateTime } from '../../../../lib/dates';
import { groupThousands } from '../../../../lib/format';
import calendar from '../../../../components/assets/calendar.svg';
import { ART, Art } from '../../../../components/primitives/Art';
import { Avatar } from '../../../../components/primitives/Avatar';
import { Button, ButtonLink } from '../../../../components/primitives/Button';
import { PageTitle } from '../../../../components/primitives/PageTitle';
import { CoinBalance } from '../../../../components/composites/CoinBalance';
import { PlayerBadges } from '../../../../components/composites/PlayerBadges';
import { cx } from '../../../../lib/cx';
import { Cover, NextMatchCard, StatusChip } from './TournamentParts';
import styles from './EventsPage.module.css';

/**
 * Events: the branch tournaments. The gamer's next match first (PC and PIN),
 * then a large card per tournament: its cover, game, format, date, places
 * and entry fee. A card opens the tournament (teams and bracket). Sample
 * data until the backend has tournaments, so registering is not open yet.
 */
export function EventsPage() {
  const { user } = useAuth();
  const plans = useActivePlans();
  const wallet = useMyWallet();
  const tournaments = useTournaments().data;
  const [filter, setFilter] = useState('all');
  const shown = filterTournaments(tournaments, filter);
  const mine = tournaments.find((t) => t.myNextMatch);

  return (
    <div className={styles.root}>
      {user && (
        <header className={styles.head}>
          <Avatar className={styles.avatar} url={user.avatarUrl} size={41} />
          <PlayerBadges className={styles.badges} user={user} tier={plans.tier} pass={plans.pass} height={24} gap={6} />
          <CoinBalance className={styles.coins} balance={wallet.data?.balance} to="/wallet" />
        </header>
      )}

      <PageTitle>Tournaments:</PageTitle>
      <p className={styles.preview}>Preview: signing up from the app opens soon.</p>

      {mine && <NextMatchCard tournament={mine} />}

      <div className={styles.filters} role="group" aria-label="Show tournaments">
        {TOURNAMENT_FILTERS.map((f) => (
          <button key={f.key} type="button" className={cx(styles.filter, filter === f.key && styles.filterOn)} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {shown.map((t) => {
          const winner = champion(t);
          const full = t.teams.length >= t.maxTeams;
          return (
            <article key={t.id} className={styles.card}>
              <Link to={`/events/${t.id}`} className={styles.cardLink}>
                <Cover tournament={t} className={styles.cover}>
                  <StatusChip status={t.status} className={styles.status} />
                  <span className={styles.fee}>{t.entryFeeCoins ? `${groupThousands(t.entryFeeCoins)} coins` : 'Free entry'}</span>
                </Cover>
                <div className={styles.body}>
                  <h2 className={styles.name}>{t.name}</h2>
                  <p className={styles.game}>
                    {t.game.name} · {formatText(t)}
                  </p>
                  <p className={styles.when}>
                    <Art src={calendar} w={ART.calendar[0]} h={ART.calendar[1]} />
                    {weekdayDateTime(t.startsAt)} · {t.branch.name}
                  </p>
                  {winner ? (
                    <p className={styles.winner}>
                      Winner: <b>{winner.name}</b>
                    </p>
                  ) : (
                    <div className={styles.places}>
                      <span className={styles.bar}>
                        <span style={{ width: `${Math.min(100, (t.teams.length / t.maxTeams) * 100)}%` }} />
                      </span>
                      <span>{full ? 'Full' : placesText(t)}</span>
                    </div>
                  )}
                </div>
              </Link>
              <div className={styles.actions}>
                {t.status === 'REGISTRATION_OPEN' && (
                  <Button size="sm" disabled title="Signing up from the app opens soon">
                    {t.teamSize === 1 ? 'Sign up' : 'Register a team'}
                  </Button>
                )}
                <ButtonLink to={`/events/${t.id}`} size="sm" variant="outline">
                  {t.status === 'COMPLETED' ? 'Results' : t.matches.length ? 'Bracket' : 'Details'}
                </ButtonLink>
              </div>
            </article>
          );
        })}
        {shown.length === 0 && <p className={styles.none}>No tournament here right now.</p>}
      </div>
    </div>
  );
}
