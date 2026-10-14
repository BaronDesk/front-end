import { Link, useParams } from 'react-router';

import type { Tournament, TournamentMatch } from '../../../../core/api-types';
import { useTournaments } from '../../../../hooks/queries';
import { champion, formatText, matchesByRound, placesText, roundName, teamOf } from '../../../../domain/tournaments';
import { weekdayDateTime } from '../../../../lib/dates';
import { groupThousands } from '../../../../lib/format';
import { Button } from '../../../../components/primitives/Button';
import { SectionTitle } from '../../../../components/primitives/SectionTitle';
import { EmptyScreen } from '../../../../components/composites/EmptyScreen';
import { cx } from '../../../../lib/cx';
import { Cover, NextMatchCard, StatusChip } from './TournamentParts';
import styles from './TournamentPage.module.css';

/** One side of a match: the team (or "To be decided") and its score; the winner stands out. */
function Side({ tournament, match, side }: { tournament: Tournament; match: TournamentMatch; side: 'A' | 'B' }) {
  const id = side === 'A' ? match.teamAId : match.teamBId;
  const score = side === 'A' ? match.scoreA : match.scoreB;
  const team = teamOf(tournament, id);
  const won = !!id && match.winnerTeamId === id;
  const lost = !!match.winnerTeamId && !won;
  return (
    <div className={cx(styles.side, won && styles.won, lost && styles.lost)}>
      <span className={cx(styles.team, !team && styles.tbd)}>{team ? team.name : 'To be decided'}</span>
      <span className={styles.score}>{score ?? ''}</span>
    </div>
  );
}

/** Under a match still to play: Live, or when it is (a played one shows its score). */
function matchNote(match: TournamentMatch): string {
  if (match.status === 'IN_PROGRESS') return 'Live';
  if (match.status === 'COMPLETED' || match.status === 'BYE') return '';
  return match.scheduledAt ? weekdayDateTime(match.scheduledAt) : 'Time to be set';
}

/** The single-elimination bracket: a column per round, the final last; it scrolls sideways on a phone. */
function Bracket({ tournament }: { tournament: Tournament }) {
  const rounds = matchesByRound(tournament);
  const firstRound = Math.max(rounds[0]?.length ?? 1, 1);
  return (
    <div className={styles.bracket} role="region" aria-label="Bracket" tabIndex={0}>
      {rounds.map((matches, i) => (
        <div key={i} className={styles.round}>
          <p className={styles.roundName}>{roundName(i + 1, rounds.length)}</p>
          <div className={cx(styles.roundMatches, i > 0 && styles.later, i < rounds.length - 1 && styles.earlier)} style={{ height: `calc(${firstRound * 86} * var(--u))` }}>
            {matches.map((m) => {
              const mine = !!tournament.myTeamId && (m.teamAId === tournament.myTeamId || m.teamBId === tournament.myTeamId);
              return (
                <div key={m.id} className={styles.matchWrap}>
                  <div className={cx(styles.match, mine && styles.mine, m.status === 'IN_PROGRESS' && styles.live)}>
                    <Side tournament={tournament} match={m} side="A" />
                    <Side tournament={tournament} match={m} side="B" />
                  </div>
                  <p className={cx(styles.note, m.status === 'IN_PROGRESS' && styles.noteLive)}>{matchNote(m)}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A tournament: its cover and facts, sign-up (not open from the app yet),
 * the gamer's next match, the bracket round by round (the gamer's matches
 * framed in gold) and the teams.
 */
export function TournamentPage() {
  const { id } = useParams();
  const tournament = useTournaments().data.find((t) => t.id === id);

  if (!tournament) {
    return (
      <EmptyScreen title="Not found" text="This tournament does not exist (any more).">
        <Link to="/events" className={styles.backLink}>
          Back to the tournaments
        </Link>
      </EmptyScreen>
    );
  }

  const t = tournament;
  const winner = champion(t);
  const solo = t.teamSize === 1;
  const facts: [string, string][] = [
    ['Game', t.game.name],
    ['Format', formatText(t)],
    ['Starts', weekdayDateTime(t.startsAt)],
    ...(t.status === 'REGISTRATION_OPEN' ? [['Sign-up closes', weekdayDateTime(t.registrationClosesAt)] as [string, string]] : []),
    ['Branch', t.branch.name],
    [solo ? 'Players' : 'Teams', placesText(t)],
    ['Entry fee', t.entryFeeCoins ? `${groupThousands(t.entryFeeCoins)} coins` : 'Free'],
    ['Match length', `${t.matchMinutes} min`],
  ];

  return (
    <div className={styles.root}>
      <Link to="/events" className={styles.back}>
        ‹ Tournaments
      </Link>

      <Cover tournament={t} className={styles.cover}>
        <StatusChip status={t.status} className={styles.status} />
      </Cover>

      <h1 className={styles.name}>{t.name}</h1>
      {winner && (
        <p className={styles.champion}>
          Champion: <b>{winner.name}</b>
        </p>
      )}

      <dl className={styles.facts}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {t.status === 'REGISTRATION_OPEN' && (
        <div className={styles.signup}>
          <Button size="lg" disabled className={styles.signupButton}>
            {solo ? 'Sign up' : 'Register a team'}
          </Button>
          <p>Signing up from the app opens soon.</p>
        </div>
      )}

      <NextMatchCard tournament={t} showName={false} />

      <SectionTitle>Bracket</SectionTitle>
      {t.matches.length ? <Bracket tournament={t} /> : <p className={styles.empty}>The bracket is drawn when sign-up closes.</p>}

      <SectionTitle>{solo ? 'Players' : 'Teams'}</SectionTitle>
      <ol className={styles.teams}>
        {t.teams.map((team, i) => (
          <li key={team.id} className={cx(styles.teamCard, team.id === t.myTeamId && styles.teamMine)}>
            <span className={styles.seed}>{team.seed ?? i + 1}</span>
            <span className={styles.teamName}>
              {team.name}
              {team.id === t.myTeamId && <span className={styles.yourTeam}>{solo ? 'You' : 'Your team'}</span>}
            </span>
            {!solo && <span className={styles.members}>{team.members.join(', ')}</span>}
          </li>
        ))}
        {Array.from({ length: Math.max(t.maxTeams - t.teams.length, 0) }, (_, i) => (
          <li key={`free-${i}`} className={cx(styles.teamCard, styles.teamFree)}>
            <span className={styles.seed}>{t.teams.length + i + 1}</span>
            <span className={styles.teamName}>Free place</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
