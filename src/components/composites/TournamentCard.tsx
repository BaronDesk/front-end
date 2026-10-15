import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { Tournament, TournamentStatus } from '../../core/api-types';
import { branchTag, cardDate, coverOf, formatName, startsInText, STATUS_TEXT, teamSizeText } from '../../domain/tournaments';
import { groupThousands } from '../../lib/format';
import { imageSrc } from '../../lib/images';
import { cx } from '../../lib/cx';
import calendarLight from '../assets/calendar-light.svg';
import coin from '../assets/coin.png';
import { ART, Art } from '../primitives/Art';
import styles from './TournamentCard.module.css';

/** Open, Upcoming, Live, Finished: on the cover's corner. */
export function StatusChip({ status, className }: { status: TournamentStatus; className?: string }) {
  return <span className={cx(styles.chip, styles[status], className)}>{STATUS_TEXT[status]}</span>;
}

/** A figure in the card's boxes (Prize Pool, Teams, Fees), with the coin when it is money. */
function Stat({ label, children, coins = false, className }: { label: string; children: ReactNode; coins?: boolean; className?: string }) {
  return (
    <div className={cx(styles.stat, className)}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        {children}
        {coins && <img className={styles.statCoin} src={coin} alt="coins" />}
      </span>
    </div>
  );
}

/**
 * A tournament's card, as the gamer app draws it: its cover (with the
 * status), name, tags (game, team size, format, branch), start, and the prize
 * pool, places and fee. With `action`, the button under them (the portal:
 * Join Tournament / My Team…; the desk: Manage). `heading`: h1 on the
 * tournament's own page. Sizes are in the design unit (--u), set by the app.
 */
export function TournamentCard({
  tournament: t,
  action,
  heading: Heading = 'h2',
  className,
}: {
  tournament: Tournament;
  action?: { to: string; label: string };
  heading?: 'h1' | 'h2';
  className?: string;
}) {
  const cover = imageSrc(coverOf(t));
  return (
    <article className={cx(styles.card, action && styles.cardActions, className)} aria-label={t.name}>
      <div className={styles.cover}>
        {cover ? <img src={cover} alt="" draggable={false} /> : <span className={styles.coverName}>{t.game.name}</span>}
        <StatusChip status={t.status} className={styles.status} />
      </div>
      <Heading className={styles.name}>{t.name}</Heading>
      <ul className={styles.tags}>
        <li>{t.game.name}</li>
        <li>{teamSizeText(t.teamSize)}</li>
        <li>{formatName(t.format)}</li>
        <li>{branchTag(t.branch.name)}</li>
      </ul>
      <div className={styles.when}>
        <Art src={calendarLight} w={ART.calendarLight[0]} h={ART.calendarLight[1]} />
        <span className={styles.date}>{cardDate(t.startsAt)}</span>
        <span className={styles.startsIn}>{startsInText(t)}</span>
      </div>
      <div className={styles.stats}>
        <Stat label="Prize Pool" coins>
          {groupThousands(t.prizePoolCoins)}
        </Stat>
        <Stat label={t.teamSize === 1 ? 'Players' : 'Teams'} className={styles.statTeams}>
          {t.teams.length}
          <span className={styles.statOf}>/{t.maxTeams}</span>
        </Stat>
        <Stat label="Fees" coins={t.entryFeeCoins > 0}>
          {t.entryFeeCoins > 0 ? groupThousands(t.entryFeeCoins) : 'Free'}
        </Stat>
      </div>
      {action && (
        <div className={styles.actions}>
          <Link to={action.to} className={styles.main}>
            {action.label}
          </Link>
        </div>
      )}
    </article>
  );
}
