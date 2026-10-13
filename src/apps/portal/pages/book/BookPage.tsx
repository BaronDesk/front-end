import { useState } from 'react';
import { Link } from 'react-router';

import type { Reservation } from '../../../../core/api-types';
import { useAuth } from '../../../../providers/AuthProvider';
import { useAction } from '../../../../hooks/useAction';
import { useActivePlans, useBranchStations, useBranches, useMyBookings, useMyWallet } from '../../../../hooks/queries';
import { bookableTimes, bookingLengthText, canCheckIn, isCancellable, stationOf } from '../../../../domain/bookings';
import { dayDateTime, dayFromValue, localDateInput } from '../../../../lib/dates';
import { describeError } from '../../../../lib/errors';
import alarm from '../../../../components/assets/alarm.svg';
import calendar from '../../../../components/assets/calendar.svg';
import { Avatar } from '../../../../components/primitives/Avatar';
import { CoinBalance } from '../../../../components/composites/CoinBalance';
import { PlayerBadges } from '../../../../components/composites/PlayerBadges';
import { ART, Art, u } from '../../../../components/primitives/Art';
import { DayPicker } from '../../../../components/composites/DayPicker';
import { ChipPicker } from '../../../../components/composites/ChipPicker';
import { reservationsService } from '../../../../services/reservations.service';
import { isTaken, panelHeight, SEAT, seatLayout } from '../../../../domain/seats';
import { Button, ButtonLink } from '../../../../components/primitives/Button';
import { Notice } from '../../../../components/primitives/Notice';
import { PageTitle } from '../../../../components/primitives/PageTitle';
import { cx } from '../../../../lib/cx';
import styles from './BookPage.module.css';


const DURATIONS = [30, 60, 90, 120, 180];
const lengthText = (m: number) => (m < 60 ? `${m} min` : `${m / 60} h`);
/** The booking page knows each station's bookings for the next 7 days. */
const DAYS_AHEAD = 6;

/** Figma "Bookings": the gamer's bookings with their PIN, and booking a seat on the room's map. */
export function BookPage() {
  const { user } = useAuth();
  const plans = useActivePlans();
  const wallet = useMyWallet();
  const homeBranchId = user?.homeBranchId ?? null;
  const bookings = useMyBookings();
  const stations = useBranchStations(homeBranchId);
  const branches = useBranches();
  const branchName = (id: string | undefined) => branches.data?.find((b) => b.id === id)?.name ?? '';
  const action = useAction();

  const [day, setDay] = useState(() => localDateInput(new Date()));
  // 'now' = Play now (the walk-in rate); otherwise a booking from that time.
  const [time, setTime] = useState('now');
  const [minutes, setMinutes] = useState(60);
  const [seatId, setSeatId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isNow = time === 'now';
  const start = isNow ? new Date() : new Date(`${day}T${time}:00`);
  const end = new Date(start.getTime() + minutes * 60_000);
  const list = stations.data ?? [];
  const seat = list.find((s) => s.id === seatId) ?? null;
  const upcoming = (bookings.data ?? []).filter((r) => r.status === 'CONFIRMED' || r.status === 'PENDING' || r.status === 'ACTIVE');

  async function reserve() {
    if (!seat) return;
    setNotice(null);
    const made = isNow
      ? await action.run('book', () => reservationsService.playNow(seat.id, minutes))
      : await action.run('book', () => reservationsService.book(seat.id, start, end));
    if (made) {
      setSeatId(null);
      setNotice(isNow ? `${seat.name} is yours: type the PIN on its lock screen.` : `Booked. Your PIN is on the booking above.`);
      bookings.reload();
      stations.reload();
    }
  }

  async function newPin(r: Reservation) {
    if (r.pin && !window.confirm('Get a new PIN? The one you have stops working.')) return;
    if (await action.run(r.id, () => reservationsService.newPin(r))) bookings.reload();
  }

  async function cancel(r: Reservation) {
    if (!window.confirm(`Cancel your booking on ${stationOf(r)}, ${dayDateTime(r.startTime)}?`)) return;
    const done = await action.run(r.id, () => reservationsService.cancel(r.id));
    if (done) {
      setOpenCard(null);
      bookings.reload();
      stations.reload();
    }
  }

  const seats = seatLayout(list.length);
  const error = action.error ?? bookings.error ?? stations.error;

  return (
    <>
      <div className={styles.root}>
        {user && (
          <header className={styles.head}>
            <Avatar className={styles.avatar} url={user.avatarUrl} size={41} />
            <PlayerBadges className={styles.badges} user={user} tier={plans.tier} pass={plans.pass} height={24} gap={6} />
            <CoinBalance className={styles.coins} balance={wallet.data?.balance} to="/wallet" />
          </header>
        )}

        <PageTitle>
          My
          <br />
          Bookings:
        </PageTitle>
        <div className={styles.cards}>
          {upcoming.map((r) => {
            const open = openCard === r.id;
            const playing = r.status === 'ACTIVE';
            const actions = playing || canCheckIn(r) || isCancellable(r);
            return (
              <article key={r.id} className={styles.booking}>
                <button type="button" className={styles.bookingMain} onClick={() => actions && setOpenCard(open ? null : r.id)} aria-expanded={actions ? open : undefined}>
                  <span className={styles.bookingStation}>{stationOf(r)}</span>
                  <span className={styles.bookingBranch}>{branchName(r.machine?.branchId)}</span>
                  <span className={styles.bookingLine} />
                  <Art className={styles.bookingAlarm} src={alarm} w={ART.alarm[0]} h={ART.alarm[1]} />
                  <span className={styles.bookingLength}>{bookingLengthText(Math.round((Date.parse(r.endTime) - Date.parse(r.startTime)) / 60_000))}</span>
                  <span className={styles.bookingCalendar}>
                    <Art src={calendar} w={ART.calendar[0]} h={ART.calendar[1]} />
                  </span>
                  <span className={styles.bookingWhen}>{dayDateTime(r.startTime)}</span>
                  <span className={styles.bookingPin}>{r.pin ? r.pin.pin : r.status === 'ACTIVE' ? 'Playing' : ''}</span>
                </button>
                {open && (
                  <div className={styles.bookingActions}>
                    {playing && (
                      <ButtonLink to="/session" size="sm">
                        My session
                      </ButtonLink>
                    )}
                    {canCheckIn(r) && (
                      <Button variant="outline" size="sm" disabled={action.busy === r.id} onClick={() => newPin(r)}>
                        New PIN
                      </Button>
                    )}
                    {isCancellable(r) && (
                      <Button variant="outline" size="sm" disabled={action.busy === r.id} onClick={() => cancel(r)}>
                        Cancel booking
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {!bookings.loading && upcoming.length === 0 && <p className={styles.bookingNone}>No booking ahead.</p>}
        </div>

        <PageTitle as="h2" className={styles.reserveTitle}>
          Reserve :
        </PageTitle>
        {homeBranchId ? (
          <section className={styles.reserve} style={{ height: u(Math.max(panelHeight(list.length), 120)) }}>
            <DayPicker
              className={cx(styles.reservePill, styles.pillDate)}
              value={day}
              daysAhead={DAYS_AHEAD}
              onChange={(v) => {
                setDay(v);
                setTime(v === localDateInput(new Date()) ? 'now' : '18:00');
                setSeatId(null);
              }}
            />
            <ChipPicker
              className={cx(styles.reservePill, styles.pillTime)}
              name="Pick a time"
              columns={6}
              value={time}
              choices={[...(day === localDateInput(new Date()) ? [{ value: 'now', label: 'Now' }] : []), ...bookableTimes(day).map((t) => ({ value: t, label: t }))]}
              onChange={(t) => (setTime(t), setSeatId(null))}
            >
              <Art src={alarm} w={ART.alarm[0]} h={ART.alarm[1]} />
              <span>{isNow ? 'Now' : time}</span>
            </ChipPicker>
            <ChipPicker
              className={cx(styles.reservePill, styles.pillLength)}
              name="Pick how long"
              columns={DURATIONS.length}
              value={minutes}
              choices={DURATIONS.map((m) => ({ value: m, label: lengthText(m) }))}
              onChange={(m) => (setMinutes(m), setSeatId(null))}
            >
              <span>{lengthText(minutes)}</span>
            </ChipPicker>

            {list.map((s, i) => {
              const taken = isTaken(s, start, end, isNow);
              const at = seats[i];
              const chosen = s.id === seatId;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={cx(styles.seat, taken && styles.seatTaken, chosen && styles.seatChosen)}
                  style={{ left: u(at.x), top: u(at.y), width: u(SEAT), height: u(SEAT) }}
                  disabled={taken}
                  aria-pressed={chosen}
                  aria-label={`${s.name}${taken ? ', taken' : ''}`}
                  title={s.name}
                  onClick={() => setSeatId(chosen ? null : s.id)}
                >
                  {i + 1}
                </button>
              );
            })}
            {stations.data && list.length === 0 && <p className={styles.reserveEmpty}>This branch has no PC to book yet.</p>}
          </section>
        ) : (
          <p className={cx(styles.reserveEmpty, styles.reserveNobranch)}>
            Pick the branch you play at to see its PCs: <Link to="/account">My account</Link>
          </p>
        )}

        {seat && (
          <div className={styles.reserveConfirm}>
            <p>
              <b>{seat.name}</b> · {isNow ? 'now' : `${dayFromValue(day)} ${time}`} · {bookingLengthText(minutes)}
            </p>
            <Button size="lg" className={styles.reserveButton} onClick={reserve} disabled={action.busy === 'book'}>
              {isNow ? 'Play now' : 'Book'}
            </Button>
          </div>
        )}
        {error ? (
          <Notice tone="error" className={styles.notice}>
            {describeError(error).message}
          </Notice>
        ) : (
          notice && <Notice className={styles.notice}>{notice}</Notice>
        )}
      </div>
    </>
  );
}
