import type { CSSProperties } from 'react';

import type { Tournament, TournamentMatch } from '../../core/api-types';
import { matchesByRound, roundName, teamOf } from '../../domain/tournaments';
import { weekdayDateTime } from '../../lib/dates';
import { cx } from '../../lib/cx';
import styles from './TournamentBracket.module.css';

/** One side of a match: the team (TBD while to be decided, Bye when nobody comes) and its score; the winner stands out. */
function Side({ tournament, match, side }: { tournament: Tournament; match: TournamentMatch; side: 'A' | 'B' }) {
  const id = side === 'A' ? match.teamAId : match.teamBId;
  const score = side === 'A' ? match.scoreA : match.scoreB;
  const team = teamOf(tournament, id);
  const won = !!id && match.winnerTeamId === id;
  const lost = !!match.winnerTeamId && !won;
  return (
    <div className={cx(styles.side, won && styles.won, lost && styles.lost)}>
      <span className={cx(styles.team, !team && styles.tbd)}>{team ? team.name : match.status === 'BYE' ? 'Bye' : <abbr title="To be decided">TBD</abbr>}</span>
      <span className={styles.score}>{score ?? ''}</span>
    </div>
  );
}

/** Under a match still to play: Live, or when it is (a played one shows its score, a bye its Bye). */
function matchNote(match: TournamentMatch): string {
  if (match.status === 'IN_PROGRESS') return 'Live';
  if (match.status === 'COMPLETED' || match.status === 'BYE') return '';
  return match.scheduledAt ? weekdayDateTime(match.scheduledAt) : 'Time to be set';
}

/**
 * The single-elimination bracket: a column per round, the final last, each
 * pair of matches joined to the one it leads to; it scrolls sideways when
 * wider than the page. The caller's matches are framed in gold, live ones in red.
 */
export function TournamentBracket({ tournament }: { tournament: Tournament }) {
  const rounds = matchesByRound(tournament);
  const firstRound = Math.max(rounds[0]?.length ?? 1, 1);
  // Every round is as tall as the first, its matches evenly spread: two neighbours are `height / count` apart.
  const height = firstRound * 86;
  return (
    <div className={styles.bracket} role="region" aria-label="Bracket" tabIndex={0}>
      {rounds.map((matches, i) => (
        <div key={i} className={styles.round}>
          <p className={styles.roundName}>{roundName(i + 1, rounds.length)}</p>
          <div
            className={cx(styles.roundMatches, i > 0 && styles.later, i < rounds.length - 1 && styles.earlier)}
            style={{ height: `calc(${height} * var(--u))`, '--half': `calc(${height / Math.max(matches.length, 1) / 2} * var(--u))` } as CSSProperties}
          >
            {matches.map((m, j) => {
              const mine = !!tournament.myTeamId && (m.teamAId === tournament.myTeamId || m.teamBId === tournament.myTeamId);
              return (
                <div key={m.id} className={styles.matchWrap}>
                  <div className={cx(styles.match, mine && styles.mine, m.status === 'IN_PROGRESS' && styles.live)}>
                    <Side tournament={tournament} match={m} side="A" />
                    <Side tournament={tournament} match={m} side="B" />
                  </div>
                  <p className={cx(styles.note, m.status === 'IN_PROGRESS' && styles.noteLive)}>{matchNote(m)}</p>
                  {/* The pair's vertical line: down from the upper match, up from the lower one, meeting at the next round's match. */}
                  {i < rounds.length - 1 && <span className={cx(styles.joint, j % 2 ? styles.jointUp : styles.jointDown)} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
