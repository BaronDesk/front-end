import type { ReactNode } from 'react';

import type { Tournament, TournamentStatus } from '../../../../core/api-types';
import { coverOf, nextMatchOf, STATUS_TEXT } from '../../../../domain/tournaments';
import { weekdayDateTime } from '../../../../lib/dates';
import { imageSrc } from '../../../../lib/images';
import { cx } from '../../../../lib/cx';
import styles from './TournamentParts.module.css';

/** Open, Upcoming, Live (with its dot), Finished. */
export function StatusChip({ status, className }: { status: TournamentStatus; className?: string }) {
  return <span className={cx(styles.chip, styles[status], className)}>{STATUS_TEXT[status]}</span>;
}

/** The tournament's cover: the uploaded one, else the game's poster, else the game's name on the brand colors. */
export function Cover({ tournament, className, children }: { tournament: Tournament; className?: string; children?: ReactNode }) {
  const src = imageSrc(coverOf(tournament));
  return (
    <div className={cx(styles.cover, className)}>
      {src ? <img src={src} alt="" /> : <span className={styles.coverName}>{tournament.game.name}</span>}
      {children}
    </div>
  );
}

/** The caller's next match: the round, who against, when, and the PC with its PIN. */
export function NextMatchCard({ tournament, showName = true }: { tournament: Tournament; showName?: boolean }) {
  const next = nextMatchOf(tournament);
  if (!next) return null;
  return (
    <section className={styles.next} aria-label="Your next match">
      <p className={styles.nextLabel}>
        Your next match{showName && <> · {tournament.name}</>}
      </p>
      <p className={styles.nextRound}>{next.round}</p>
      <p className={styles.nextTeams}>
        <b>{next.team?.name ?? 'Your team'}</b> vs <b>{next.opponent?.name ?? 'to be decided'}</b>
      </p>
      <dl className={styles.nextFacts}>
        <div>
          <dt>When</dt>
          <dd>{next.match.scheduledAt ? weekdayDateTime(next.match.scheduledAt) : 'to be set'}</dd>
        </div>
        <div>
          <dt>PC</dt>
          <dd>{next.machineName}</dd>
        </div>
        <div>
          <dt>PIN</dt>
          <dd className={styles.nextPin}>{next.pin}</dd>
        </div>
      </dl>
    </section>
  );
}
