import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { ReservationStatus, Session, SessionStatus, StaffReservation, StaffSession, Station } from '../../../../core/api-types';
import { useOnReconnect, useRealtimeEvent } from '../../../../providers/RealtimeProvider';
import { ErrorBox } from '../../components/ErrorBox';
import { formatClock, formatDateTime, formatDuration, formatCoins, secondsSince } from '../../../../lib/format';
import { useNow } from '../../../../hooks/useNow';
import { ActionMessages } from '../../components/ActionMessages';
import { useAction } from '../../../../hooks/useAction';
import { useApiQuery } from '../../../../hooks/useApiQuery';
import { dayFromValue, dayRange, localDateInput } from '../../../../lib/dates';
import { useBranchScope } from '../../providers/BranchContext';
import { applyStatus, stationLabel } from '../../../../domain/stations';
import { useStationList } from '../../hooks/useStationList';
import { useStationNames } from '../../hooks/useStationNames';
import { isOpenSession, SESSION_STATUS_TEXT } from '../../../../domain/sessions';
import { isCancellable, RESERVATION_TEXT, slotRange, type Slot } from '../../../../domain/bookings';
import { roomsOf, type Room } from '../../../../domain/seats';
import { EmptyRow } from '../../components/EmptyRow';
import { BranchSection } from '../../components/BranchSection';
import { RoomMap } from '../../components/RoomMap';
import { SlotPicker } from '../../../../components/composites/SlotPicker';
import { reservationsService } from '../../../../services/reservations.service';
import { sessionsService } from '../../../../services/sessions.service';
import styles from './BookingsPage.module.css';
import { Select } from '../../../../components/primitives/Select';
import { DateField } from '../../../../components/composites/DateField';

const LIST_LIMIT = 100;
const LIST_STATUSES: SessionStatus[] = ['ACTIVE', 'PAUSED', 'PENDING', 'COMPLETED', 'CANCELLED'];
/** Bookings raise no live event (gamers book in their app): they are re-read this often. */
const BOOKINGS_POLL_MS = 30_000;
/** A booking that holds its station for its time (a cancelled or missed one does not). */
const HOLDING: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED'];

type Range = { start: Date; end: Date; isNow: boolean };
const overlaps = (r: StaffReservation, range: Range) => Date.parse(r.startTime) < range.end.getTime() && Date.parse(r.endTime) > range.start.getTime();

/**
 * Bookings and sessions at the desk. The app's slot pickers on
 * top (any day): each branch's room shows that slot as in the app (red =
 * booked), the sessions running in it (today), and its bookings of that day,
 * which the desk can cancel until someone plays. Below, the sessions played
 * since a day, with their gamer and bill. HQ: the branch picked in the header.
 */
export function BookingsPage() {
  const action = useAction();
  const { isHq, branchId, branchName, inScope, scoped } = useBranchScope();
  const stations = useStationList();
  const stationNames = useStationNames();

  // The slot the rooms show, picked as in the app; "now" moves with the clock.
  const [slot, setSlot] = useState<Slot>(() => ({ day: localDateInput(new Date()), time: 'now', minutes: 60 }));
  const now = useNow(30_000);
  const range = slotRange(slot, new Date(now));
  const today = slot.day === localDateInput(new Date(now));

  // The picked day's bookings (and past its end when the slot runs over midnight).
  const day = dayRange(slot.day, 1);
  const bookingParams = new URLSearchParams({
    from: day.from,
    to: new Date(Math.max(Date.parse(day.to), range.end.getTime())).toISOString(),
    limit: '500',
  });
  const bookings = useApiQuery<StaffReservation[]>(scoped(reservationsService.paths.staff(bookingParams)));
  const reloadBookings = bookings.reload;
  useEffect(() => {
    const timer = setInterval(reloadBookings, BOOKINGS_POLL_MS);
    return () => clearInterval(timer);
  }, [reloadBookings]);

  // The sessions history.
  const [since, setSince] = useState(localDateInput);
  const [status, setStatus] = useState('');
  const params = new URLSearchParams({ from: dayRange(since, 1).from, limit: String(LIST_LIMIT) });
  if (status) params.set('status', status);
  const sessions = useApiQuery<StaffSession[]>(scoped(sessionsService.paths.list(params)));
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A session starting or ending changes a station's status: one reload per burst.
  function reloadSessionsSoon() {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(sessions.reload, 1_000);
  }
  const [warnings, setWarnings] = useState<{ sessionId: string; machineId: string; at: string }[]>([]);

  useRealtimeEvent('station_status', (e) => {
    if (!inScope(e.branchId)) return;
    stations.setData((list) => list?.map((s) => (s.serialNumber === e.serialNumber ? applyStatus(s, e) : s)));
    reloadSessionsSoon();
  });
  useRealtimeEvent('session_runout_warning', (e) =>
    setWarnings((w) => [{ ...e, at: new Date().toISOString() }, ...w.filter((x) => x.sessionId !== e.sessionId)].slice(0, 5)),
  );
  useOnReconnect(() => {
    stations.reload();
    sessions.reload();
    bookings.reload();
  });

  async function cancel(r: StaffReservation) {
    const when = formatDateTime(r.startTime);
    if (!window.confirm(`Cancel ${r.gamerUsername}'s booking on ${stationLabel(r.machine)} at ${when}? Its PIN stops working.`)) return;
    const done = await action.run(r.id, () => reservationsService.cancelAsStaff(r.id), `Booking of ${r.gamerUsername} at ${when} cancelled.`);
    if (done) bookings.reload();
  }

  // One room per branch: every station on the map; its bookings of the day below.
  const rooms = roomsOf(stations.data ?? [], branchName);
  const dayBookings = bookings.data ?? [];
  const booked = new Set(dayBookings.filter((r) => HOLDING.includes(r.status) && overlaps(r, range)).map((r) => r.machineId));
  const rows = sessions.data ?? [];
  const showBranch = isHq && !branchId;

  return (
    <>
      <h1>Bookings</h1>
      <div className={styles.when}>
        <SlotPicker value={slot} onChange={setSlot} anyDay anyTime classNames={{ day: styles.pillDate, time: styles.pillTime, length: styles.pillLength }} />
      </div>
      <ActionMessages action={action} />
      {warnings.map((w) => (
        <div key={w.sessionId} className="msg msg-error">
          {formatClock(w.at)} &nbsp; <b>{stationNames.get(w.machineId) ?? 'A station'}</b>: the gamer&apos;s balance runs out soon, then the
          station locks. <Link to={`/sessions/${w.sessionId}`}>Session »</Link>
        </div>
      ))}
      <ErrorBox error={stations.error} />
      <ErrorBox error={bookings.error} />

      {rooms.map((room) => (
        <BranchRoom
          key={room.branchId}
          room={room}
          range={range}
          today={today}
          day={slot.day}
          booked={booked}
          bookings={dayBookings.filter((r) => r.machine.branchId === room.branchId)}
          action={action}
          onCancel={cancel}
        />
      ))}
      {!stations.loading && rooms.length === 0 && <p className="msg">No stations yet.</p>}

      <h2 className={styles.history}>Sessions</h2>
      <div className="toolbar">
        <label htmlFor="se-date">Since</label>{' '}
        <DateField id="se-date" value={since} onChange={setSince} />
        <span className="sep-v" />
        <label htmlFor="se-status">Status</label>{' '}
        <Select
          id="se-status"
          value={status}
          onChange={setStatus}
          options={[{ value: '', label: 'All but cancelled' }, ...LIST_STATUSES.map((st) => ({ value: st, label: SESSION_STATUS_TEXT[st] }))]}
        />
        <span className="sep-v" />
        <button type="button" className="secondary" onClick={sessions.reload}>
          Reload
        </button>
        {sessions.loading && <span className="muted"> loading…</span>}
      </div>
      <ErrorBox error={sessions.error} />
      <table className="grid">
        <thead>
          <tr>
            <th>Started</th>
            <th>Station</th>
            {showBranch && <th>Branch</th>}
            <th>Gamer</th>
            <th>Status</th>
            <th>Played</th>
            <th>Bill</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <SessionRow key={s.id} session={s} branch={showBranch ? branchName(s.station.branchId) : null} />
          ))}
          {!sessions.loading && rows.length === 0 && <EmptyRow colSpan={showBranch ? 8 : 7}>No session since that day.</EmptyRow>}
        </tbody>
      </table>
      {rows.length === LIST_LIMIT && <p className="muted">Showing the newest {LIST_LIMIT}: pick a later day to see fewer.</p>}
    </>
  );
}

/**
 * One branch: its room at the picked slot, the sessions running in it (on
 * today), and its bookings of the picked day (those in the slot marked).
 */
function BranchRoom({
  room,
  range,
  today,
  day,
  booked,
  bookings,
  action,
  onCancel,
}: {
  room: Room<Station>;
  range: Range;
  today: boolean;
  day: string;
  booked: ReadonlySet<string>;
  bookings: StaffReservation[];
  action: ReturnType<typeof useAction>;
  onCancel(r: StaffReservation): void;
}) {
  const here = room.stations.filter((s) => s.sessionId);
  const seatOf = (machineId: string) => room.stations.findIndex((s) => s.id === machineId) + 1 || '—';

  return (
    <BranchSection name={room.name}>
      {/* A seat in session opens its session, any other its station. */}
      <RoomMap
        stations={room.stations}
        slot={{ now: range.isNow, booked }}
        linkOf={(s) => (s.sessionId ? `/sessions/${s.sessionId}` : `/stations/${s.id}`)}
      />

      {today && (
        <>
          <h3>Running now</h3>
          <table className="grid">
            <thead>
              <tr>
                <th>Seat</th>
                <th>Station</th>
                <th>Status</th>
                <th>Started</th>
                <th>Rate</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {here.map((s) => (
                <RunningRow key={s.id} seat={room.stations.indexOf(s) + 1} station={s} action={action} />
              ))}
              {here.length === 0 && <EmptyRow colSpan={6}>No station of this branch reports a session.</EmptyRow>}
            </tbody>
          </table>
        </>
      )}

      <h3>Bookings {today ? 'today' : `on ${dayFromValue(day)}`}</h3>
      <table className="grid">
        <thead>
          <tr>
            <th>Start</th>
            <th>End</th>
            <th>Seat</th>
            <th>Station</th>
            <th>Gamer</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {bookings.map((r) => (
            <tr key={r.id} className={HOLDING.includes(r.status) && overlaps(r, range) ? 'row-current' : undefined}>
              <td>{formatClock(r.startTime).slice(0, 5)}</td>
              <td>{formatClock(r.endTime).slice(0, 5)}</td>
              <td className="muted">{seatOf(r.machineId)}</td>
              <td>
                <Link to={`/stations/${r.machineId}`}>
                  <b>{stationLabel(r.machine)}</b>
                </Link>
              </td>
              <td>
                <b>{r.gamerUsername}</b>
              </td>
              <td className={r.status === 'NO_SHOW' || r.status === 'CANCELLED' ? 'muted' : r.status === 'ACTIVE' ? 'status-ok' : ''}>
                {RESERVATION_TEXT[r.status]}
              </td>
              <td>
                {isCancellable(r) && (
                  <button type="button" className="danger" disabled={action.busy === r.id} onClick={() => onCancel(r)}>
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
          {bookings.length === 0 && <EmptyRow colSpan={7}>No booking that day.</EmptyRow>}
        </tbody>
      </table>
    </BranchSection>
  );
}

function RunningRow({ seat, station, action }: { seat: number; station: Station; action: ReturnType<typeof useAction> }) {
  const now = useNow(1_000);
  const session = useApiQuery<Session>(station.sessionId ? sessionsService.paths.one(station.sessionId) : null);
  const s = session.data;

  async function end() {
    if (!s || !window.confirm(`End the session on ${stationLabel(station)} and bill it now?`)) return;
    const cmd = await action.run(
      s.id,
      () => sessionsService.end(s.id),
      'End sent to the station. The bill is ready once the station confirms (see the session page).',
    );
    if (cmd) session.reload();
  }

  return (
    <tr>
      <td className="muted">{seat}</td>
      <td>
        <Link to={`/stations/${station.id}`}>
          <b>{stationLabel(station)}</b>
        </Link>
      </td>
      <td>{s ? SESSION_STATUS_TEXT[s.status] : session.error ? <span className="status-bad">unknown session</span> : '…'}</td>
      <td>
        {s?.startTime ? (
          <>
            {formatClock(s.startTime)} <span className="muted">({formatDuration(secondsSince(s.startTime, now))})</span>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>{s?.rateCoinsPerHour != null ? `${formatCoins(s.rateCoinsPerHour)} / h` : '—'}</td>
      <td className="nowrap">
        {s && isOpenSession(s.status) && (
          <>
            <button type="button" className="danger" disabled={action.busy === s.id} onClick={end}>
              End &amp; bill
            </button>{' '}
          </>
        )}
        <Link to={`/sessions/${station.sessionId}`}>Details »</Link>
      </td>
    </tr>
  );
}

function SessionRow({ session: s, branch }: { session: StaffSession; branch: string | null }) {
  const open = isOpenSession(s.status);
  return (
    <tr>
      <td>{formatDateTime(s.startTime)}</td>
      <td>
        <Link to={`/stations/${s.station.id}`}>{s.station.name ?? s.station.serialNumber}</Link>
      </td>
      {branch !== null && <td>{branch}</td>}
      <td>
        <b>{s.gamerUsername}</b>
      </td>
      <td className={open ? 'status-ok' : ''}>{SESSION_STATUS_TEXT[s.status]}</td>
      <td>{open ? <span className="muted">running</span> : formatDuration(s.meteredSeconds)}</td>
      <td>
        {s.billingBreakdown ? (
          <b>{formatCoins(s.billingBreakdown.totalCoins)}</b>
        ) : s.costSoFarCoins != null ? (
          <span className="muted">{formatCoins(s.costSoFarCoins)} so far</span>
        ) : (
          <span className="muted">not billed yet</span>
        )}
      </td>
      <td>
        <Link to={`/sessions/${s.id}`}>Details »</Link>
      </td>
    </tr>
  );
}
