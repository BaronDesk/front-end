import type { ReactNode } from 'react';

import { useSessionHistory } from '../../../../hooks/queries';
import { dayDateTime } from '../../../../lib/dates';
import { formatDuration, groupThousands } from '../../../../lib/format';
import { Card } from '../../../../components/primitives/Card';
import { Notice } from '../../../../components/primitives/Notice';
import { PageTitle } from '../../../../components/primitives/PageTitle';
import styles from './InfoPages.module.css';

/** A Settings sub-page in the design's language: the big title, then cards (Bookings' card style). */
function InfoScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className={styles.root}>
        <PageTitle>{title}</PageTitle>
        <div className={styles.cards}>{children}</div>
      </div>
    </>
  );
}

/** Settings → Sessions History: the gamer's settled sessions, latest first. */
export function HistoryPage() {
  const history = useSessionHistory();
  const rows = history.data ?? [];
  return (
    <InfoScreen title="Sessions History">
      {rows.map((s) => (
        <Card as="article" key={s.sessionId}>
          <p className={styles.historyTop}>
            <span className={styles.historyStation}>{s.stationName}</span>
            <span className={styles.historyBranch}>{s.branchName}</span>
          </p>
          <p className={styles.historyWhen}>{dayDateTime(s.settledAt)}</p>
          <p className={styles.historyFigures}>
            <span>{formatDuration(s.meteredSeconds)} played</span>
            <span>{s.totalCoins === 0 ? 'Free' : `${groupThousands(s.totalCoins)} coins`}</span>
            {s.xpEarned !== null && <span>+{s.xpEarned} XP</span>}
          </p>
        </Card>
      ))}
      {history.data && rows.length === 0 && <Card as="p">No session yet: book a PC and play!</Card>}
      {Boolean(history.error) && (
        <Notice tone="error" align="center">
          Your sessions could not be loaded.
        </Notice>
      )}
    </InfoScreen>
  );
}

const FAQ: [string, string][] = [
  ['How do I start playing?', 'Book a PC on Bookings, or pick “Now” to play at once. Every booking comes with a PIN: type it on that PC’s lock screen.'],
  ['How much does it cost?', 'Your price per hour is on Settings, under Membership. You pay for the time you really play, by the second, when your session ends.'],
  ['How do I add coins?', 'At the desk: pay in cash and the staff add the coins to your wallet (1000 coins = 1 DT).'],
  ['What if I am late?', 'Your PIN works from the start of your booking, for 30 minutes. After that the booking is missed and the PC is free again.'],
  ['What happens when my coins run out?', 'The PC locks. Top up at the desk and it unlocks.'],
  ['How do I earn XP?', 'By playing: 25 XP for every 15 minutes. Your XP takes you up the ranks, from Wood to GrandMaster.'],
  ['What do memberships and passes give?', 'A membership lowers your price per hour and lets you book further ahead. A pass gives free or cheaper play at set times, like the night. See them all on Settings → See All.'],
];

/** Settings → FAQ: how BaronDesk works, in short answers. */
export function FaqPage() {
  return (
    <InfoScreen title="FAQ">
      {FAQ.map(([q, a]) => (
        <Card as="article" key={q}>
          <h2 className={styles.question}>{q}</h2>
          <p>{a}</p>
        </Card>
      ))}
    </InfoScreen>
  );
}

const TERMS: [string, string][] = [
  ['Your account', 'Your account is yours alone: keep your password and your PINs to yourself.'],
  ['Paying', 'Play is paid in coins from your wallet, for the time played, when the session ends. Coins are bought at the desk.'],
  ['Bookings', 'A booking holds a PC for you. Cancel it before anyone logs in; after 30 minutes without a login it is missed and the PC is freed.'],
  ['Memberships and passes', 'They are paid from your wallet and last the days shown. Cancelling a membership ends it at once, without a refund.'],
  ['Using the PCs', 'Respect the PCs and the other players. The staff may end a session that breaks the rules of the branch.'],
];

/** Settings → Terms Of Service: the rules of play, in short. */
export function TermsPage() {
  return (
    <InfoScreen title="Terms Of Service">
      {TERMS.map(([title, text]) => (
        <Card as="article" key={title}>
          <h2 className={styles.question}>{title}</h2>
          <p>{text}</p>
        </Card>
      ))}
    </InfoScreen>
  );
}
