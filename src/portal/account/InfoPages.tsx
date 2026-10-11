import type { ReactNode } from 'react';

import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { formatDuration, groupThousands } from '../../shared/lib/format';

/** A Settings sub-page in the design's language: the big title, then cards (Bookings' card style). */
function InfoScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="bd-info">
        <h1 className="bd-book-title">{title}</h1>
        <div className="bd-info-cards">{children}</div>
      </div>
    </>
  );
}

/** GET /sessions/me/history */
interface HistoryRow {
  sessionId: string;
  stationName: string;
  branchName: string;
  startTime: string;
  settledAt: string;
  meteredSeconds: number;
  totalCoins: number;
  chargedCoins: number;
  xpEarned: number | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const when = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Settings → Sessions History: the gamer's settled sessions, latest first. */
export function HistoryPage() {
  const history = useApiQuery<HistoryRow[]>('/sessions/me/history');
  const rows = history.data ?? [];
  return (
    <InfoScreen title="Sessions History">
      {rows.map((s) => (
        <article key={s.sessionId} className="bd-info-card bd-history">
          <p className="bd-history-top">
            <span className="bd-history-station">{s.stationName}</span>
            <span className="bd-history-branch">{s.branchName}</span>
          </p>
          <p className="bd-history-when">{when(s.settledAt)}</p>
          <p className="bd-history-figures">
            <span>{formatDuration(s.meteredSeconds)} played</span>
            <span>{s.totalCoins === 0 ? 'Free' : `${groupThousands(s.totalCoins)} coins`}</span>
            {s.xpEarned !== null && <span>+{s.xpEarned} XP</span>}
          </p>
        </article>
      ))}
      {history.data && rows.length === 0 && <p className="bd-info-card">No session yet: book a PC and play!</p>}
      {Boolean(history.error) && <p className="bd-auth-error">Your sessions could not be loaded.</p>}
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
        <article key={q} className="bd-info-card">
          <h2 className="bd-info-question">{q}</h2>
          <p>{a}</p>
        </article>
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
        <article key={title} className="bd-info-card">
          <h2 className="bd-info-question">{title}</h2>
          <p>{text}</p>
        </article>
      ))}
    </InfoScreen>
  );
}
