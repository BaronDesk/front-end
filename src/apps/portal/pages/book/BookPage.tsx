import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { Reservation } from '../../../../core/api-types';
import { useAuth } from '../../../../providers/AuthProvider';
import { useAction } from '../../../../hooks/useAction';
import { useActivePlans, useBranchStations, useBranches, useMyBookings, useMyMemberships, useMySubscriptions, useMyWallet, usePricing } from '../../../../hooks/queries';
import { bookingPrice, committedCoins, playNowLength, type PlayNowLength } from '../../../../domain/pricing';
import { formatClock, groupThousands } from '../../../../lib/format';
import { bookingLengthText, canCheckIn, isCancellable, slotRange, stationOf, UNTIL_BALANCE, type Slot } from '../../../../domain/bookings';
import { dayDateTime, dayFromValue, localDateInput } from '../../../../lib/dates';
import { describeError } from '../../../../lib/errors';
import alarm from '../../../../components/assets/alarm.svg';
import calendar from '../../../../components/assets/calendar.svg';
import { Avatar } from '../../../../components/primitives/Avatar';
import { CoinBalance } from '../../../../components/composites/CoinBalance';
import { PlayerBadges } from '../../../../components/composites/PlayerBadges';
import { ART, Art, u } from '../../../../components/primitives/Art';
import { SlotPicker } from '../../../../components/composites/SlotPicker';
import { reservationsService } from '../../../../services/reservations.service';
import { isTaken, panelHeight, SEAT, seatLayout } from '../../../../domain/seats';
import { Button, ButtonLink } from '../../../../components/primitives/Button';
import { Notice } from '../../../../components/primitives/Notice';
import { PageTitle } from '../../../../components/primitives/PageTitle';
import { cx } from '../../../../lib/cx';
import styles from './BookPage.module.css';

/** What ends a Max Play now, after its length. */
function untilText(length: PlayNowLength): string {
  if (length.limit === 'balance') return 'until your coins run out';
  if (length.limit === 'booked') return `until ${formatClock(length.until.toISOString()).slice(0, 5)}, booked then`;
  return 'the longest Play now';
}

/**
 * Bookings: the gamer's bookings with their PIN, and booking a seat on the
 * room's map with its price. Play now (time "Now") takes only a PC that is on
 * and free, can run until the coins run out (Max), and opens My session.
 */
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
  const navigate = useNavigate();

  // time 'now' = Play now (the walk-in rate); otherwise a booking from that time.
  const [slot, setSlot] = useState<Slot>(() => ({ day: localDateInput(new Date()), time: 'now', minutes: 60 }));
  const { day, time, minutes } = slot;
  const [seatId, setSeatId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { start, end, isNow } = slotRange(slot);
  const list = stations.data ?? [];
  const seat = list.find((s) => s.id === seatId) ?? null;
  const upcoming = (bookings.data ?? []).filter((r) => r.status === 'CONFIRMED' || r.status === 'PENDING' || r.status === 'ACTIVE');

  // Shown once the prices and the gamer's tier and passes are known, so a discount is never missed.
  const pricing = usePricing();
  const memberships = useMyMemberships();
  const subscriptions = useMySubscriptions();
  const rates =
    pricing.data && memberships.data && subscriptions.data
      ? { pricing: pricing.data, memberships: memberships.data, subscriptions: subscriptions.data }
      : null;
  // Max: as long as the coins left after the bookings ahead last on the chosen PC.
  const untilBalance = isNow && minutes === UNTIL_BALANCE;
  const maxLength =
    untilBalance && seat && rates && wallet.data && bookings.data
      ? playNowLength({
          now: start,
          coinsPerHour: bookingPrice({ ...rates, isNow, start, minutes: 60 }).coinsPerHour,
          coinsLeft: wallet.data.balance - committedCoins(bookings.data, rates, start),
          seatBookings: seat.bookings,
          myBookings: bookings.data,
        })
      : null;
  const playMinutes = untilBalance ? (maxLength?.minutes ?? null) : minutes;
  const price = rates && playMinutes ? bookingPrice({ ...rates, isNow, start, minutes: playMinutes }) : null;
  const noneFreeNow = isNow && list.length > 0 && list.every((s) => isTaken(s, start, end, true));

  async function reserve() {
    if (!seat || !playMinutes) return;
    setNotice(null);
    const made = isNow
      ? await action.run('book', () => reservationsService.playNow(seat.id, playMinutes))
      : await action.run('book', () => reservationsService.book(seat.id, start, end));
    if (made) {
      setSeatId(null);
      bookings.reload();
      stations.reload();
      // My session shows the PIN to type on the PC, then the time and cost once playing.
      if (isNow) navigate('/session');
      else setNotice('Booked. Your PIN is on the booking above.');
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
            <SlotPicker
              untilBalance
              value={slot}
              onChange={(next) => (setSlot(next), setSeatId(null))}
              classNames={{
                day: cx(styles.reservePill, styles.pillDate),
                time: cx(styles.reservePill, styles.pillTime),
                length: cx(styles.reservePill, styles.pillLength),
              }}
            />

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
        {homeBranchId && noneFreeNow && <Notice className={styles.notice}>No PC is switched on and free right now. Pick a later time to book one.</Notice>}

        {seat && (
          <div className={styles.reserveConfirm}>
            <p>
              <b>{seat.name}</b> · {isNow ? 'now' : `${dayFromValue(day)} ${time}`}
              {playMinutes ? ` · ${bookingLengthText(playMinutes)}` : ''}
              {maxLength && maxLength.minutes > 0 && `, ${untilText(maxLength)}`}
              {price && (
                <>
                  <br />
                  {price.coins === 0 ? <b>Free</b> : <>{untilBalance && 'up to '}<b>{groupThousands(price.coins)}</b> coins</>}
                  {price.discountPercent > 0 && price.coins > 0 && ` (−${price.discountPercent} %)`}
                  <br />
                  <span className={styles.rate}>
                    {groupThousands(price.coinsPerHour)} coins/h{isNow && ' · you pay only the time you play'}
                  </span>
                </>
              )}
              {maxLength?.minutes === 0 && (
                <>
                  <br />
                  {maxLength.limit === 'booked' ? 'You or this PC have a booking now.' : 'Your coins cover no play time: top up first.'}
                </>
              )}
            </p>
            <Button size="lg" className={styles.reserveButton} onClick={reserve} disabled={action.busy === 'book' || !playMinutes}>
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
