import { useState } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { Branch, BranchStation, Reservation, WalkIn } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { canCheckIn, isCancellable, stationOf } from '../../shared/lib/bookings';
import { describeError, explainRefusal } from '../../shared/lib/errors';
import alarm from '../ui/assets/alarm.svg';
import calendar from '../ui/assets/calendar.svg';
import { Avatar } from '../ui/Avatar';
import { CoinBalance } from '../ui/CoinBalance';
import { PlayerBadges } from '../ui/PlayerBadges';
import { Screen } from '../ui/Screen';
import { ART, Art, u } from '../ui/units';
import { DayPicker, dayValue } from './DayPicker';
import { requestPin } from './Pin';
import { isTaken, panelHeight, SEAT, seatLayout } from './seats';

/** The server's booking refusals, in words a gamer understands. */
const BOOKING_REFUSALS: Record<string, string> = {
  MACHINE_UNAVAILABLE: 'This PC is not available (to play now it must be switched on). Pick another one or ask the desk.',
  RESERVATION_SLOT_TAKEN: 'Someone already booked this PC for that time. Pick another time or PC.',
  GAMER_ALREADY_BOOKED: 'You already have a booking at that time: one PC at a time.',
  BOOKING_TOO_FAR_AHEAD: 'That is too far ahead for your plan. A higher membership lets you book further ahead.',
  INSUFFICIENT_FUNDS: 'Your balance does not cover this booking (your other bookings count too). Top up at the desk, or book less time.',
  PRICING_NOT_SET: 'Play is not open yet. Ask the desk.',
};
const explain = (err: unknown) => explainRefusal(err, BOOKING_REFUSALS);

const DURATIONS = [30, 60, 90, 120, 180];
/** The booking page knows each station's bookings for the next 7 days. */
const DAYS_AHEAD = 6;

const pad = (n: number) => String(n).padStart(2, '0');
/** 14/10/2026 */
const dayText = (value: string) => value.split('-').reverse().join('/');
/** 14/10/2026 14:00 */
const dateTimeText = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "2 Hours", "1 Hour 30 Min", "45 Min" */
function lengthText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h ? `${h} ${h === 1 ? 'Hour' : 'Hours'}` : '';
  return [hours, m ? `${m} Min` : ''].filter(Boolean).join(' ');
}

/** The times offered on a day: every half hour, from the next one when it is today. */
function timesOf(day: string): string[] {
  const now = new Date();
  const today = day === dayValue(now);
  const times: string[] = [];
  for (let t = 0; t < 24 * 60; t += 30) {
    if (today && t <= now.getHours() * 60 + now.getMinutes()) continue;
    times.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return times;
}

/** Figma "Bookings": the gamer's bookings with their PIN, and booking a seat on the room's map. */
export function BookPage() {
  const { user } = useAuth();
  const homeBranchId = user?.homeBranchId ?? null;
  const bookings = useApiQuery<Reservation[]>('/reservations');
  const stations = useApiQuery<BranchStation[]>(homeBranchId ? `/branches/${homeBranchId}/stations` : null);
  const branches = useApiQuery<Branch[]>('/branches');
  const branchName = (id: string | undefined) => branches.data?.find((b) => b.id === id)?.name ?? '';
  const action = useAction();

  const [day, setDay] = useState(() => dayValue(new Date()));
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
      ? await action.run('book', () => api<WalkIn>('POST', '/reservations/walk-in', { machineId: seat.id, durationMinutes: minutes }).catch(explain))
      : await action.run('book', () =>
          api<WalkIn>('POST', '/reservations', { machineId: seat.id, startTime: start.toISOString(), endTime: end.toISOString() }).catch(explain),
        );
    if (made) {
      setSeatId(null);
      setNotice(isNow ? `${seat.name} is yours: type the PIN on its lock screen.` : `Booked. Your PIN is on the booking above.`);
      bookings.reload();
      stations.reload();
    }
  }

  async function newPin(r: Reservation) {
    if (r.pin && !window.confirm('Get a new PIN? The one you have stops working.')) return;
    if (await action.run(r.id, () => requestPin(r))) bookings.reload();
  }

  async function cancel(r: Reservation) {
    if (!window.confirm(`Cancel your booking on ${stationOf(r)}, ${dateTimeText(r.startTime)}?`)) return;
    const done = await action.run(r.id, () => api('DELETE', `/reservations/${r.id}`).then(() => true));
    if (done) {
      setOpenCard(null);
      bookings.reload();
      stations.reload();
    }
  }

  const seats = seatLayout(list.length);
  const error = action.error ?? bookings.error ?? stations.error;

  return (
    <Screen nav="book">
      <div className="bd-book">
        {user && (
          <header className="bd-book-head">
            <Avatar url={user.avatarUrl} size={41} />
            <PlayerBadges user={user} height={24} gap={6} />
            <CoinBalance />
          </header>
        )}

        <h1 className="bd-book-title">
          My
          <br />
          Bookings:
        </h1>
        <div className="bd-book-cards">
          {upcoming.map((r) => {
            const open = openCard === r.id;
            const actions = canCheckIn(r) || isCancellable(r);
            return (
              <article key={r.id} className="bd-booking">
                <button type="button" className="bd-booking-main" onClick={() => actions && setOpenCard(open ? null : r.id)} aria-expanded={actions ? open : undefined}>
                  <span className="bd-booking-station">{stationOf(r)}</span>
                  <span className="bd-booking-branch">{branchName(r.machine?.branchId)}</span>
                  <span className="bd-booking-line" />
                  <Art className="bd-booking-alarm" src={alarm} w={ART.alarm[0]} h={ART.alarm[1]} />
                  <span className="bd-booking-length">{lengthText(Math.round((Date.parse(r.endTime) - Date.parse(r.startTime)) / 60_000))}</span>
                  <span className="bd-booking-calendar">
                    <Art src={calendar} w={ART.calendar[0]} h={ART.calendar[1]} />
                  </span>
                  <span className="bd-booking-when">{dateTimeText(r.startTime)}</span>
                  <span className="bd-booking-pin">{r.pin ? r.pin.pin : r.status === 'ACTIVE' ? 'Playing' : ''}</span>
                </button>
                {open && (
                  <div className="bd-booking-actions">
                    {canCheckIn(r) && (
                      <button type="button" disabled={action.busy === r.id} onClick={() => newPin(r)}>
                        New PIN
                      </button>
                    )}
                    {isCancellable(r) && (
                      <button type="button" disabled={action.busy === r.id} onClick={() => cancel(r)}>
                        Cancel booking
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {!bookings.loading && upcoming.length === 0 && <p className="bd-booking-none">No booking ahead.</p>}
        </div>

        <h2 className="bd-book-title bd-book-reserve-title">Reserve :</h2>
        {homeBranchId ? (
          <section className="bd-reserve" style={{ height: u(Math.max(panelHeight(list.length), 120)) }}>
            <DayPicker
              value={day}
              daysAhead={DAYS_AHEAD}
              onChange={(v) => {
                setDay(v);
                setTime(v === dayValue(new Date()) ? 'now' : '18:00');
                setSeatId(null);
              }}
            />
            <label className="bd-pill bd-pill-time">
              <Art className="bd-pill-alarm" src={alarm} w={ART.alarm[0]} h={ART.alarm[1]} />
              <span>{isNow ? 'Now' : time}</span>
              <select aria-label="From" value={time} onChange={(e) => (setTime(e.target.value), setSeatId(null))}>
                {day === dayValue(new Date()) && <option value="now">Now</option>}
                {timesOf(day).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="bd-pill bd-pill-length">
              <span>{minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}</span>
              <select aria-label="How long" value={minutes} onChange={(e) => (setMinutes(Number(e.target.value)), setSeatId(null))}>
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </option>
                ))}
              </select>
            </label>

            {list.map((s, i) => {
              const taken = isTaken(s, start, end, isNow);
              const at = seats[i];
              const chosen = s.id === seatId;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`bd-seat${taken ? ' bd-seat-taken' : ''}${chosen ? ' bd-seat-chosen' : ''}`}
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
            {stations.data && list.length === 0 && <p className="bd-reserve-empty">This branch has no PC to book yet.</p>}
          </section>
        ) : (
          <p className="bd-reserve-empty bd-reserve-nobranch">
            Pick the branch you play at to see its PCs: <Link to="/account">My account</Link>
          </p>
        )}

        {seat && (
          <div className="bd-reserve-confirm">
            <p>
              <b>{seat.name}</b> · {isNow ? 'now' : `${dayText(day)} ${time}`} · {lengthText(minutes)}
            </p>
            <button type="button" className="bd-auth-submit" onClick={reserve} disabled={action.busy === 'book'}>
              {isNow ? 'Play now' : 'Book'}
            </button>
          </div>
        )}
        {error ? <p className="bd-auth-error">{describeError(error).message}</p> : notice && <p className="bd-book-notice">{notice}</p>}
      </div>
    </Screen>
  );
}
