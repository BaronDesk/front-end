import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import type { CheckIn, CurrentSession, Reservation, SessionNoticeEvent } from '../../../../core/api-types';
import { useRealtimeEvent } from '../../../../providers/RealtimeProvider';
import { useAction } from '../../../../hooks/useAction';
import { useCurrentSession, useExtendOptions, useMyBookings } from '../../../../hooks/queries';
import { currentBooking, stationOf } from '../../../../domain/bookings';
import { formatClock, formatDuration, groupThousands } from '../../../../lib/format';
import { useNow } from '../../../../hooks/useNow';
import { reservationsService } from '../../../../services/reservations.service';
import { ActionNote, Notice } from '../../../../components/primitives/Notice';
import { Button, ButtonLink, ButtonRow } from '../../../../components/primitives/Button';
import { Card } from '../../../../components/primitives/Card';
import { SectionTitle } from '../../../../components/primitives/SectionTitle';
import { PageTitle } from '../../../../components/primitives/PageTitle';
import { Page } from '../../../../components/layout/Page';
import { cx } from '../../../../lib/cx';
import styles from './SessionPage.module.css';

/** The session's numbers are re-read this often (the notices arrive live). */
const POLL_MS = 15_000;

/** The Extend buttons show from this long before the end (and whenever the station warned). */
const EXTEND_FROM_MS = 15 * 60_000;



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
  const current = useCurrentSession();
  const bookings = useMyBookings();
  const session = current.data ?? null;
  const extendOptions = useExtendOptions(session?.reservationId ?? null);
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
    const c = await action.run('pin', () => reservationsService.newPin(r), 'Here is your new PIN.');
    if (c) {
      setPin(c);
      bookings.reload();
    }
  }

  async function extend(minutes: number) {
    if (!session) return;
    const done = await action.run(
      `extend-${minutes}`,
      () => reservationsService.extend(session.reservationId, minutes),
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
    <Page>
      <PageTitle>My Session</PageTitle>

      {notice?.kind === 'LOW_BALANCE' && (
        <Card as="p" tone="alert">
          <b>Low balance:</b> the PC locks {notice.endsAt ? `at ${formatClock(notice.endsAt)}` : 'soon'}. Top up at the desk to keep playing.
        </Card>
      )}
      {notice?.kind === 'TIME_LEFT' && (
        <Card as="p">
          <b>Your time ends {notice.endsAt ? `at ${formatClock(notice.endsAt)}` : 'soon'}.</b> The PC locks then: extend below to keep playing.
        </Card>
      )}

      {session ? (
        <>
          <section className={styles.root}>
            <div className={styles.top}>
              <span className={styles.station}>{session.station.name ?? session.station.serialNumber}</span>
              <span className={session.status === 'ACTIVE' ? styles.chip : cx(styles.chip, styles.chipOff)}>
                {session.status === 'ACTIVE' ? 'Playing' : session.status === 'PAUSED' ? 'Locked' : 'Waiting'}
              </span>
            </div>
            <p className={styles.label}>Time played</p>
            <p className={styles.played}>{formatDuration(session.playedSeconds)}</p>
            <dl className={styles.figures}>
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
                  {groupThousands(session.costSoFarCoins)}
                  <small>coins · {groupThousands(session.rateCoinsPerHour)} / h</small>
                </dd>
              </div>
              <div>
                <dt>Balance after</dt>
                <dd>
                  {groupThousands(session.balanceAfterCoins)}
                  <small>coins · paid at the end</small>
                </dd>
              </div>
            </dl>
          </section>
          {lockText(session) && <Notice tone="error">{lockText(session)}</Notice>}
          {session.status === 'PENDING' && <Notice>Type your PIN on the PC&apos;s lock screen to start.</Notice>}

          {showExtend && (
            <section>
              <SectionTitle>Keep playing?</SectionTitle>
              <Notice>The session stops at {formatClock(session.endsAt).slice(0, 5)}. Extra time is paid at the pay-as-you-go rate.</Notice>
              <ButtonRow className={styles.extendButtons}>
                {(extendOptions.data?.options ?? []).map((o) => (
                  <Button
                    key={o.minutes}
                    variant="outline"
                    disabled={!o.available || action.busy === `extend-${o.minutes}`}
                    onClick={() => extend(o.minutes)}
                  >
                    +{o.minutes} min · {groupThousands(o.costCoins)}
                  </Button>
                ))}
              </ButtonRow>
              {extendOptions.data && !extendOptions.data.options.some((o) => o.available) && (
                <Notice>
                  {extendOptions.data.options.some((o) => o.reason === 'SLOT_TAKEN') ? 'The PC is booked right after you.' : 'Your balance does not cover extra time.'}
                </Notice>
              )}
            </section>
          )}
        </>
      ) : booking ? (
        <Card as="section" className={styles.booking}>
          <p className={styles.bookingStation}>{stationOf(booking)}</p>
          <p>
            Booked {formatClock(booking.startTime).slice(0, 5)} – {formatClock(booking.endTime).slice(0, 5)}
          </p>
          {bookingPin && (
            <>
              <p className={styles.pin}>{bookingPin}</p>
              <Notice className={styles.bookingNote}>
                Type it on that PC&apos;s lock screen{Date.parse(booking.startTime) > now ? ` from ${formatClock(booking.startTime).slice(0, 5)}` : ''}.
              </Notice>
            </>
          )}
          <Button variant="outline" disabled={action.busy === 'pin'} onClick={() => getPin(booking)}>
            New PIN
          </Button>
          <Notice className={styles.bookingNote}>Lost it, or too many wrong tries? A new PIN replaces the old one.</Notice>
        </Card>
      ) : (
        <Card as="section" className={styles.none}>
          <p>You are not playing now.</p>
          <ButtonLink to="/book" size="lg" className={styles.book}>
            Book a PC
          </ButtonLink>
        </Card>
      )}

      <ActionNote action={action} />
      <p className={styles.pageLink}>
        <Link to="/history">Sessions History »</Link>
      </p>
    </Page>
  );
}
