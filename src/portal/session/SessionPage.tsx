import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { CheckIn, CurrentSession, ExtendOptions, Reservation, SessionNoticeEvent } from '../../api/types';
import { useRealtimeEvent } from '../../realtime/RealtimeContext';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { currentBooking, stationOf } from '../../shared/lib/bookings';
import { explainRefusal } from '../../shared/lib/errors';
import { formatClock, formatDuration, groupThousands, useNow } from '../../shared/lib/format';
import { requestPin } from '../booking/Pin';
import { ActionNote } from '../ui/ActionNote';

/** The session's numbers are re-read this often (the notices arrive live). */
const POLL_MS = 15_000;

/** The Extend buttons show from this long before the end (and whenever the station warned). */
const EXTEND_FROM_MS = 15 * 60_000;

const EXTEND_REFUSALS: Record<string, string> = {
  RESERVATION_SLOT_TAKEN: 'Someone booked this PC right after you: extending is not possible.',
  INSUFFICIENT_FUNDS: 'Your balance does not cover the extra time. Top up at the desk.',
  GAMER_ALREADY_BOOKED: 'You have another booking at that time.',
  SESSION_NOT_RUNNING: 'Your session is no longer running.',
};

const explainExtend = (err: unknown) => explainRefusal(err, EXTEND_REFUSALS);
const coins = (n: number) => `${groupThousands(n)} coins`;

function lockText(s: CurrentSession): string | null {
  if (s.status !== 'PAUSED') return null;
  if (s.lockReason === 'runout') return 'Locked: your balance ran out. Top up at the desk and it unlocks by itself.';
  if (s.lockReason === 'offline') return 'The PC lost its connection. It resumes when it is back.';
  return 'Locked by the desk.';
}

/**
 * My session (brief §6.6), in the design's style: the PC, time played, what it
 * has cost so far and what the wallet holds after it, when it ends; near the
 * end, Extend (the PC must be free and the wallet cover it). The station's
 * warnings (low balance, time left) show here too. Before the session starts,
 * the booking's PIN. Money is taken when the session ends.
 */
export function SessionPage() {
  const current = useApiQuery<CurrentSession | null>('/sessions/me/current');
  const bookings = useApiQuery<Reservation[]>('/reservations');
  const session = current.data ?? null;
  const extendOptions = useApiQuery<ExtendOptions>(session ? `/reservations/${session.reservationId}/extend-options` : null);
  const now = useNow(1_000);
  const action = useAction();
  const [pin, setPin] = useState<CheckIn | null>(null);
  const [notice, setNotice] = useState<SessionNoticeEvent | null>(null);
  const booking = session ? undefined : currentBooking(bookings.data, now);

  const { reload: reloadCurrent } = current;
  const { reload: reloadBookings } = bookings;
  useEffect(() => {
    const timer = setInterval(() => {
      reloadCurrent();
      reloadBookings();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [reloadCurrent, reloadBookings]);

  useRealtimeEvent('session_notice', (e) => {
    setNotice(e.kind === 'CLEAR' ? null : e);
    reloadCurrent();
  });

  async function getPin(r: Reservation) {
    if (r.pin && !window.confirm('Get a new PIN? The one you have stops working.')) return;
    const c = await action.run('pin', () => requestPin(r), 'Here is your new PIN.');
    if (c) {
      setPin(c);
      bookings.reload();
    }
  }

  async function extend(minutes: number) {
    if (!session) return;
    const done = await action.run(
      `extend-${minutes}`,
      () => api<{ endsAt: string }>('POST', `/reservations/${session.reservationId}/extend`, { minutes }).catch(explainExtend),
      (r) => `Extended: you play until ${formatClock(r.endsAt)}.`,
    );
    if (done) {
      setNotice(null);
      current.reload();
      extendOptions.reload();
    }
  }

  const msLeft = session ? Date.parse(session.endsAt) - now : 0;
  const showExtend = session && (msLeft <= EXTEND_FROM_MS || notice?.kind === 'TIME_LEFT');
  const bookingPin = booking && (pin?.reservationId === booking.id ? pin.pin : booking.pin?.pin);

  return (
    <div className="bd-page">
      <h1 className="bd-book-title">My Session</h1>

      {notice?.kind === 'LOW_BALANCE' && (
        <p className="bd-card bd-card-alert">
          <b>Low balance:</b> the PC locks {notice.endsAt ? `at ${formatClock(notice.endsAt)}` : 'soon'}. Top up at the desk to keep playing.
        </p>
      )}
      {notice?.kind === 'TIME_LEFT' && (
        <p className="bd-card">
          <b>Your time ends {notice.endsAt ? `at ${formatClock(notice.endsAt)}` : 'soon'}.</b> The PC locks then: extend below to keep playing.
        </p>
      )}

      {session ? (
        <>
          <section className="bd-session">
            <div className="bd-session-top">
              <span className="bd-session-station">{session.station.name ?? session.station.serialNumber}</span>
              <span className={session.status === 'ACTIVE' ? 'bd-session-chip' : 'bd-session-chip bd-session-chip-off'}>
                {session.status === 'ACTIVE' ? 'Playing' : session.status === 'PAUSED' ? 'Locked' : 'Waiting'}
              </span>
            </div>
            <p className="bd-session-label">Time played</p>
            <p className="bd-session-played">{formatDuration(session.playedSeconds)}</p>
            <dl className="bd-session-figures">
              <div>
                <dt>Ends</dt>
                <dd>
                  {formatClock(session.endsAt).slice(0, 5)}
                  <small>{formatDuration(Math.max(msLeft / 1000, 0))} left</small>
                </dd>
              </div>
              <div>
                <dt>Cost so far</dt>
                <dd>
                  {coins(session.costSoFarCoins)}
                  <small>{coins(session.rateCoinsPerHour)} / hour</small>
                </dd>
              </div>
              <div>
                <dt>Balance after</dt>
                <dd>
                  {coins(session.balanceAfterCoins)}
                  <small>paid at the end</small>
                </dd>
              </div>
            </dl>
          </section>
          {lockText(session) && <p className="bd-note bd-note-error">{lockText(session)}</p>}
          {session.status === 'PENDING' && <p className="bd-note">Type your PIN on the PC&apos;s lock screen to start.</p>}

          {showExtend && (
            <section className="bd-extend">
              <h2 className="bd-section-head">Keep playing?</h2>
              <p className="bd-note">The session stops at {formatClock(session.endsAt).slice(0, 5)}. Extra time is paid at the pay-as-you-go rate.</p>
              <div className="bd-row-buttons">
                {(extendOptions.data?.options ?? []).map((o) => (
                  <button
                    key={o.minutes}
                    type="button"
                    className="bd-btn-outline"
                    disabled={!o.available || action.busy === `extend-${o.minutes}`}
                    onClick={() => extend(o.minutes)}
                  >
                    +{o.minutes} min · {groupThousands(o.costCoins)}
                  </button>
                ))}
              </div>
              {extendOptions.data && !extendOptions.data.options.some((o) => o.available) && (
                <p className="bd-note">
                  {extendOptions.data.options.some((o) => o.reason === 'SLOT_TAKEN') ? 'The PC is booked right after you.' : 'Your balance does not cover extra time.'}
                </p>
              )}
            </section>
          )}
        </>
      ) : booking ? (
        <section className="bd-card bd-session-booking">
          <p className="bd-session-booking-station">{stationOf(booking)}</p>
          <p>
            Booked {formatClock(booking.startTime).slice(0, 5)} – {formatClock(booking.endTime).slice(0, 5)}
          </p>
          {bookingPin && (
            <>
              <p className="bd-session-pin">{bookingPin}</p>
              <p className="bd-note">Type it on that PC&apos;s lock screen{Date.parse(booking.startTime) > now ? ` from ${formatClock(booking.startTime).slice(0, 5)}` : ''}.</p>
            </>
          )}
          <button type="button" className="bd-btn-outline" disabled={action.busy === 'pin'} onClick={() => getPin(booking)}>
            New PIN
          </button>
          <p className="bd-note">Lost it, or too many wrong tries? A new PIN replaces the old one.</p>
        </section>
      ) : (
        <section className="bd-card bd-session-none">
          <p>You are not playing now.</p>
          <Link to="/book" className="bd-auth-submit bd-btn-link">
            Book a PC
          </Link>
        </section>
      )}

      <ActionNote action={action} />
      <p className="bd-page-link">
        <Link to="/history">Sessions History »</Link>
      </p>
    </div>
  );
}
