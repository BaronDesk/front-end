import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { Tournament, TournamentStatus } from '../../../../core/api-types';
import {
  branchTag,
  cardAction,
  cardDate,
  coverOf,
  formatName,
  matchDate,
  nextMatchOf,
  startsInText,
  STATUS_TEXT,
  teamSizeText,
} from '../../../../domain/tournaments';
import { useAuth } from '../../../../providers/AuthProvider';
import { useActivePlans, useMyWallet } from '../../../../hooks/queries';
import { groupThousands } from '../../../../lib/format';
import { imageSrc } from '../../../../lib/images';
import { cx } from '../../../../lib/cx';
import calendarLight from '../../../../components/assets/calendar-light.svg';
import coin from '../../../../components/assets/coin.png';
import { ART, Art } from '../../../../components/primitives/Art';
import { Avatar } from '../../../../components/primitives/Avatar';
import { CoinBalance } from '../../../../components/composites/CoinBalance';
import { PlayerBadges } from '../../../../components/composites/PlayerBadges';
import styles from './TournamentParts.module.css';

/** The top of both tournament pages, as on Bookings: the gamer's picture, badges and coins. */
export function PlayerHeader() {
  const { user } = useAuth();
  const plans = useActivePlans();
  const wallet = useMyWallet();
  if (!user) return null;
  return (
    <header className={styles.head}>
      <Avatar className={styles.avatar} url={user.avatarUrl} size={41} />
      <PlayerBadges className={styles.badges} user={user} tier={plans.tier} pass={plans.pass} height={24} gap={6} />
      <CoinBalance className={styles.coins} balance={wallet.data?.balance} to="/wallet" />
    </header>
  );
}

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
 * A tournament's card: its cover (with the status), name, tags (game, team
 * size, format, branch), start, and the prize pool, places and fee. With
 * `actions`, the button under them that opens the tournament.
 * `heading`: h1 on the tournament's own page.
 */
export function TournamentCard({ tournament: t, actions = false, heading: Heading = 'h2', className }: { tournament: Tournament; actions?: boolean; heading?: 'h1' | 'h2'; className?: string }) {
  const cover = imageSrc(coverOf(t));
  return (
    <article className={cx(styles.card, actions && styles.cardActions, className)} aria-label={t.name}>
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
      {actions && (
        <div className={styles.actions}>
          <Link to={`/events/${t.id}`} className={styles.main}>
            {cardAction(t)}
          </Link>
        </div>
      )}
    </article>
  );
}

/** The caller's next match: the round, both teams, when, the PC and its PIN. The dot blinks: it is on. */
export function NextMatchCard({ tournament }: { tournament: Tournament }) {
  const next = nextMatchOf(tournament);
  if (!next) return null;
  const poster = imageSrc(coverOf(tournament));
  return (
    <Link to={`/events/${tournament.id}`} className={styles.next} aria-label={`Your next match: ${next.round}, ${next.team?.name ?? 'your team'} against ${next.opponent?.name ?? 'to be decided'}`}>
      {poster && <img className={styles.nextPoster} src={poster} alt="" />}
      <span className={styles.nextLabel}>Your Next Match : {next.round}</span>
      <span className={styles.nextDot} />
      <span className={styles.nextTeamA}>{next.team?.name ?? 'Your team'}</span>
      <span className={styles.nextTeamB}>{next.opponent?.name ?? 'To be decided'}</span>
      <span className={styles.nextStrip}>
        <span className={styles.nextWhen}>{next.match.scheduledAt ? matchDate(next.match.scheduledAt) : 'Time to be set'}</span>
        <span className={styles.nextPc}>{next.machineName}</span>
        <span className={styles.nextPin}>{next.pin}</span>
      </span>
    </Link>
  );
}
