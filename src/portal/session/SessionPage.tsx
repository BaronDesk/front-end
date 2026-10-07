import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { CheckIn, CurrentSession, ExtendOptions, Reservation, SessionNoticeEvent, WalletEntry } from '../../api/types';
import { useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { explainRefusal } from '../../shared/lib/errors';
import { formatClock, formatDateTime, formatDuration, formatMillimes, formatSignedMillimes, useNow } from '../../shared/lib/format';
import { ActionMessages } from '../../shared/components/ActionMessages';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { currentBooking, stationOf } from '../../shared/lib/bookings';
import { PinBox, requestPin } from '../booking/Pin';

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

function lockText(s: CurrentSession): string | null {
  if (s.status !== 'PAUSED') return null;
  if (s.lockReason === 'runout') return 'Locked: your balance ran out. Top up at the desk and it unlocks by itself.';
  if (s.lockReason === 'offline') return 'The PC lost its connection. It resumes when it is back.';
  return 'Locked by the desk.';
}

/**
 * My session (brief §6.6): the station, time played, what it has cost so far
 * and what the wallet holds after it, when it ends — and, near the end,
 * Extend (the PC must be free and the wallet cover it). The station's
 * warnings (low balance, time left) show here too. Money is taken when the
 * session ends.
 */
export function SessionPage() {
  const current = useApiQuery<CurrentSession | null>('/sessions/me/current');
  const bookings = useApiQuery<Reservation[]>('/reservations');
  const entries = useApiQuery<WalletEntry[]>('/wallets/me/entries?take=30');
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
    const c = await action.run('pin', () => requestPin(r));
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

  const charges = (entries.data ?? []).filter((x) => x.sessionId).slice(0, 5);
  const msLeft = session ? Date.parse(session.endsAt) - now : 0;
  const showExtend = session && (msLeft <= EXTEND_FROM_MS || notice?.kind === 'TIME_LEFT');

  return (
    <>
      <h1>My session</h1>
      <ErrorBox error={current.error ?? bookings.error} />
      <ActionMessages action={action} />

      {notice?.kind === 'LOW_BALANCE' && (
        <div className="msg msg-error">
          <b>Low balance:</b> the PC locks {notice.endsAt ? `at ${formatClock(notice.endsAt)}` : 'soon'}. Top up at the desk to keep playing.
        </div>
      )}
      {notice?.kind === 'TIME_LEFT' && (
        <div className="msg">
          <b>Your time ends {notice.endsAt ? `at ${formatClock(notice.endsAt)}` : 'soon'}.</b> The PC locks then; extend below to keep playing.
        </div>
      )}

      {session ? (
        <>
          <table className="kv">
            <tbody>
              <tr>
                <th>Station</th>
                <td>
                  <b>{session.station.name ?? session.station.serialNumber}</b>
                </td>
              </tr>
              <tr>
                <th>Status</th>
                <td className={session.status === 'ACTIVE' ? 'status-ok' : 'status-bad'}>
                  {session.status === 'ACTIVE' ? 'Playing' : (lockText(session) ?? 'Waiting for the PIN on the PC')}
                </td>
              </tr>
              <tr>
                <th>Played</th>
                <td>{formatDuration(session.playedSeconds)}</td>
              </tr>
              <tr>
                <th>Ends</th>
                <td>
                  {formatClock(session.endsAt)} <span className="muted">({formatDuration(Math.max(msLeft / 1000, 0))} left)</span>
                </td>
              </tr>
              <tr>
                <th>Cost so far</th>
                <td>
                  {formatMillimes(session.costSoFarCents)} <span className="muted">({formatMillimes(session.rateCentsPerMinute)} / minute)</span>
                </td>
              </tr>
              <tr>
                <th>Balance after</th>
                <td>
                  {formatMillimes(session.balanceAfterCents)} <span className="muted">(paid when the session ends)</span>
                </td>
              </tr>
            </tbody>
          </table>

          {showExtend && (
            <fieldset>
              <legend>Keep playing?</legend>
              <p className="muted">The session stops at {formatClock(session.endsAt)}. Extra time is paid at the pay-as-you-go rate.</p>
              {(extendOptions.data?.options ?? []).map((o) => (
                <span key={o.minutes}>
                  <button type="button" disabled={!o.available || action.busy === `extend-${o.minutes}`} onClick={() => extend(o.minutes)}>
                    +{o.minutes} min ({formatMillimes(o.costCents)})
                  </button>{' '}
                </span>
              ))}
              {extendOptions.data && !extendOptions.data.options.some((o) => o.available) && (
                <p className="muted">
                  {extendOptions.data.options.some((o) => o.reason === 'SLOT_TAKEN')
                    ? 'The PC is booked right after you.'
                    : 'Your balance does not cover extra time.'}
                </p>
              )}
            </fieldset>
          )}
        </>
      ) : booking ? (
        <>
          {(pin?.reservationId === booking.id || booking.pin) && (
            <PinBox
              pin={pin?.reservationId === booking.id ? pin.pin : booking.pin!.pin}
              station={stationOf(booking)}
              validFrom={booking.startTime}
              validUntil={pin?.reservationId === booking.id ? pin.pinExpiresAt : (booking.pin?.validUntil ?? null)}
            />
          )}
          <table className="kv">
            <tbody>
              <tr>
                <th>Station</th>
                <td>
                  <b>{stationOf(booking)}</b>
                </td>
              </tr>
              <tr>
                <th>Booked</th>
                <td>
                  {formatClock(booking.startTime)} – {formatClock(booking.endTime)}
                </td>
              </tr>
              <tr>
                <th>PIN</th>
                <td>
                  <button type="button" className="secondary" disabled={action.busy === 'pin'} onClick={() => getPin(booking)}>
                    New PIN
                  </button>
                  <div className="muted">Lost it, or too many wrong tries? A new PIN replaces the old one.</div>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <p>
          You are not playing now. <Link to="/book">Book a station »</Link>
        </p>
      )}

      <h2>Last sessions</h2>
      <table className="grid">
        <tbody>
          {charges.map((x) => (
            <tr key={x.id}>
              <td>{formatDateTime(x.createdAt)}</td>
              <td>Play time</td>
              <td className="status-bad">{formatSignedMillimes(x.amount)}</td>
            </tr>
          ))}
          {!entries.loading && charges.length === 0 && (
            <tr>
              <td className="muted">No session billed yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
