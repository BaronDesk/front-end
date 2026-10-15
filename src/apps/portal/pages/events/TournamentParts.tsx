import { Link } from 'react-router';

import type { Tournament } from '../../../../core/api-types';
import { coverOf, matchDate, nextMatchOf } from '../../../../domain/tournaments';
import { useAuth } from '../../../../providers/AuthProvider';
import { useActivePlans, useMyWallet } from '../../../../hooks/queries';
import { imageSrc } from '../../../../lib/images';
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
      <span className={styles.nextTeamB}>{next.opponent?.name ?? 'TBD'}</span>
      <span className={styles.nextStrip}>
        <span className={styles.nextWhen}>{next.match.scheduledAt ? matchDate(next.match.scheduledAt) : 'Time to be set'}</span>
        <span className={styles.nextPc}>{next.machineName}</span>
        <span className={styles.nextPin}>{next.pin}</span>
      </span>
    </Link>
  );
}
