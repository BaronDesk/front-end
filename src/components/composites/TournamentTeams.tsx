import type { ReactNode } from 'react';

import type { Tournament, TournamentTeam } from '../../core/api-types';
import { cx } from '../../lib/cx';
import styles from './TournamentTeams.module.css';

/**
 * The teams (or players, solo) signed up: seed, name, members, the caller's
 * own marked, then the free places. `extra` adds something at the end of a
 * team's row (the desk: Remove); `className` places the list.
 */
export function TournamentTeams({ tournament: t, extra, className }: { tournament: Tournament; extra?: (team: TournamentTeam) => ReactNode; className?: string }) {
  const solo = t.teamSize === 1;
  return (
    <ol className={cx(styles.teams, className)}>
      {t.teams.map((team, i) => (
        <li key={team.id} className={cx(styles.teamRow, team.id === t.myTeamId && styles.teamMine)}>
          <span className={styles.seed}>{team.seed ?? i + 1}</span>
          <span className={styles.teamRowName}>
            {team.name}
            {team.id === t.myTeamId && <span className={styles.yourTeam}>{solo ? 'You' : 'Your team'}</span>}
            {extra && <span className={styles.extra}>{extra(team)}</span>}
          </span>
          {!solo && <span className={styles.members}>{team.members.join(', ')}</span>}
        </li>
      ))}
      {Array.from({ length: Math.max(t.maxTeams - t.teams.length, 0) }, (_, i) => (
        <li key={`free-${i}`} className={cx(styles.teamRow, styles.teamFree)}>
          <span className={styles.seed}>{t.teams.length + i + 1}</span>
          <span className={styles.teamRowName}>Free place</span>
        </li>
      ))}
    </ol>
  );
}
