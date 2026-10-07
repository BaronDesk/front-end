import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { Command, Session, SessionStatus, StaffSession, Station } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { formatClock, formatDateTime, formatDuration, formatMillimes, secondsSince, useNow } from '../../shared/lib/format';
import { ActionMessages } from '../../shared/components/ActionMessages';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { dayRange, localDateInput } from '../../shared/lib/dates';
import { useBranchScope } from '../branches/BranchContext';
import { applyStatus, stationLabel } from '../stations/station';
import { useStationList } from '../stations/useStationList';
import { useStationNames } from '../stations/useStationNames';
import { isOpenSession, SESSION_STATUS_TEXT } from './labels';
import { EmptyRow } from '../../shared/components/EmptyRow';

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
  const sessions = useApiQuery<StaffSession[]>(scoped(`/sessions?${params}`));
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
      <table className="grid">
        <thead>
          <tr>
            <th>Station</th>
            <th>Status</th>
            <th>Started</th>
            <th>Rate</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {running.map((s) => (
            <RunningRow key={s.id} station={s} action={action} />
          ))}
          {!stations.loading && running.length === 0 && (
            <EmptyRow colSpan={5}>No station reports a session.</EmptyRow>
          )}
        </tbody>
      </table>

      <h2>Sessions</h2>
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

function RunningRow({ station, action }: { station: Station; action: ReturnType<typeof useAction> }) {
  const now = useNow(1_000);
  const session = useApiQuery<Session>(`/sessions/${station.sessionId}`);
  const s = session.data;

  async function end() {
    if (!s || !window.confirm(`End the session on ${stationLabel(station)} and bill it now?`)) return;
    const cmd = await action.run(
      s.id,
      () => api<Command>('POST', `/sessions/${s.id}/end`, { reason: 'staff_end' }),
      'End sent to the station. The bill is ready once the station confirms (see the session page).',
    );
    if (cmd) session.reload();
  }

  return (
    <tr>
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
      <td>{s?.rateCentsPerMinute != null ? `${formatMillimes(s.rateCentsPerMinute)} / min` : '—'}</td>
      <td className="nowrap">
        {s && isOpenSession(s.status) && (
          <>
            <button type="button" disabled={action.busy === s.id} onClick={end}>
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
          <b>{formatMillimes(s.billingBreakdown.totalCents)}</b>
        ) : s.costSoFarCents != null ? (
          <span className="muted">{formatMillimes(s.costSoFarCents)} so far</span>
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
