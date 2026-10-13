import { useRef, useState } from 'react';
import { Link } from 'react-router';

import type { Session, SessionStatus, StaffSession, Station } from '../../../../core/api-types';
import { useOnReconnect, useRealtimeEvent } from '../../../../providers/RealtimeProvider';
import { ErrorBox } from '../../components/ErrorBox';
import { formatClock, formatDateTime, formatDuration, formatCoins, secondsSince } from '../../../../lib/format';
import { useNow } from '../../../../hooks/useNow';
import { ActionMessages } from '../../components/ActionMessages';
import { useAction } from '../../../../hooks/useAction';
import { useApiQuery } from '../../../../hooks/useApiQuery';
import { dayRange, localDateInput } from '../../../../lib/dates';
import { useBranchScope } from '../../providers/BranchContext';
import { applyStatus, stationLabel } from '../../../../domain/stations';
import { useStationList } from '../../hooks/useStationList';
import { useStationNames } from '../../hooks/useStationNames';
import { isOpenSession, SESSION_STATUS_TEXT } from '../../../../domain/sessions';
import { EmptyRow } from '../../components/EmptyRow';
import { BranchSection } from '../../components/BranchSection';
import { RoomMap } from '../../components/RoomMap';
import { roomsOf } from '../../../../domain/seats';
import styles from './SessionsPage.module.css';
import { sessionsService } from '../../../../services/sessions.service';

const LIST_LIMIT = 100;
const LIST_STATUSES: SessionStatus[] = ['ACTIVE', 'PAUSED', 'PENDING', 'COMPLETED', 'CANCELLED'];

/**
 * Session & Financial Control at the desk (brief §6.6). Gamers start their
 * own sessions: the portal gets them a one-time PIN for their booking, which
 * they type on the station's lock screen. "Running now" is every station that
 * reports a session (live); below, GET /sessions lists the sessions played
 * since a day, with their gamer and bill (HQ: the branch in the top bar).
 */
export function SessionsPage() {
  const action = useAction();
  const { isHq, branchId, branchName, inScope, scoped } = useBranchScope();
  const stations = useStationList();
  const stationNames = useStationNames();
  const [date, setDate] = useState(localDateInput);
  const [status, setStatus] = useState('');
  const params = new URLSearchParams({ from: dayRange(date, 1).from, limit: String(LIST_LIMIT) });
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
  });

  const running = (stations.data ?? []).filter((s) => s.sessionId);
  // One room per branch: every station on the map, the running ones in its table.
  const rooms = roomsOf(stations.data ?? [], branchName);
  const rows = sessions.data ?? [];
  const showBranch = isHq && !branchId;

  return (
    <>
      <h1>Sessions</h1>
      <ActionMessages action={action} />
      {warnings.map((w) => (
        <div key={w.sessionId} className="msg msg-error">
          {formatClock(w.at)} &nbsp; <b>{stationNames.get(w.machineId) ?? 'A station'}</b>: the gamer&apos;s balance runs out soon, then the
          station locks. <Link to={`/sessions/${w.sessionId}`}>Session »</Link>
        </div>
      ))}

      <p className="muted">
        Gamers start their own sessions: they book in the BaronDesk app (or pick <i>Play now</i>), get a PIN there and type it on the
        station&apos;s lock screen. Nothing to do at the desk.
      </p>

      <h2>Running now ({running.length})</h2>
      <ErrorBox error={stations.error} />
      {rooms.map((room) => {
        const here = room.stations.filter((s) => s.sessionId);
        return (
          <BranchSection key={room.branchId} name={room.name} figures={`${here.length} of ${room.stations.length} stations in session`}>
            {/* A seat in session opens its session, any other its station. */}
            <RoomMap
              stations={room.stations}
              linkOf={(s) => (s.sessionId ? `/sessions/${s.sessionId}` : `/stations/${s.id}`)}
            />
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
                {!stations.loading && here.length === 0 && <EmptyRow colSpan={6}>No station of this branch reports a session.</EmptyRow>}
              </tbody>
            </table>
          </BranchSection>
        );
      })}
      {!stations.loading && rooms.length === 0 && <p className="msg">No stations yet.</p>}

      <h2 className={styles.history}>Sessions</h2>
      <div className="toolbar">
        <label htmlFor="se-date">Since</label>{' '}
        <input id="se-date" type="date" required value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <span className="sep-v" />
        <label htmlFor="se-status">Status</label>{' '}
        <select id="se-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All but cancelled</option>
          {LIST_STATUSES.map((st) => (
            <option key={st} value={st}>
              {SESSION_STATUS_TEXT[st]}
            </option>
          ))}
        </select>
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
          {!sessions.loading && rows.length === 0 && (
            <EmptyRow colSpan={showBranch ? 8 : 7}>No session since that day.</EmptyRow>
          )}
        </tbody>
      </table>
      {rows.length === LIST_LIMIT && <p className="muted">Showing the newest {LIST_LIMIT}: pick a later day to see fewer.</p>}
      <p className="muted">Bookings nobody has logged into yet are on the Bookings page.</p>
    </>
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
