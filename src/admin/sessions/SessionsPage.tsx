import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { Command, Session, Station } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatClock, formatDuration, formatMillimes, secondsSince, useNow } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { applyStatus, stationLabel } from '../stations/station';
import { useStationList } from '../stations/useStationList';
import { useStationNames } from '../useLookups';
import { isOpenSession, SESSION_STATUS_TEXT } from './labels';
import { useRecentSessions } from './recent';

/**
 * Session & Financial Control at the desk (brief §6.6). Gamers start their
 * own sessions: the portal gets them a one-time PIN for their booking, which
 * they type on the station's lock screen. There is no list of sessions on the
 * API, so "running now" is every station that reports a session, and the
 * desk keeps the sessions it saw running (this browser only) to find their
 * bills.
 */
export function SessionsPage() {
  const action = useAction();
  const { inScope } = useBranchScope();
  const stations = useStationList();
  const stationNames = useStationNames();
  const recent = useRecentSessions();
  const [warnings, setWarnings] = useState<{ sessionId: string; machineId: string; at: string }[]>([]);

  useRealtimeEvent('station_status', (e) => {
    if (!inScope(e.branchId)) return;
    stations.setData((list) => list?.map((s) => (s.serialNumber === e.serialNumber ? applyStatus(s, e) : s)));
  });
  useRealtimeEvent('session_runout_warning', (e) =>
    setWarnings((w) => [{ ...e, at: new Date().toISOString() }, ...w.filter((x) => x.sessionId !== e.sessionId)].slice(0, 5)),
  );
  useOnReconnect(stations.reload);

  const running = (stations.data ?? []).filter((s) => s.sessionId);

  // Remember every session seen running here, to find its bill once it ends.
  const { ids: recentIds, add: addRecent } = recent;
  useEffect(() => {
    for (const s of running) if (s.sessionId && !recentIds.includes(s.sessionId)) addRecent(s.sessionId);
  }, [running, recentIds, addRecent]);

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
            <tr>
              <td colSpan={5} className="muted">
                No station reports a session.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Seen at this desk</h2>
      <table className="grid">
        <thead>
          <tr>
            <th>Session</th>
            <th>Status</th>
            <th>Played</th>
            <th>Bill</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {recent.ids.map((id) => (
            <RecentRow key={id} id={id} />
          ))}
          {recent.ids.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Nothing yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {recent.ids.length > 0 && (
        <p>
          <button type="button" className="secondary" onClick={recent.clear}>
            Clear this list
          </button>
        </p>
      )}
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

function RecentRow({ id }: { id: string }) {
  const session = useApiQuery<Session>(`/sessions/${id}`);
  const s = session.data;
  return (
    <tr>
      <td>
        <code>{id.slice(0, 8)}</code>
      </td>
      <td>{s ? SESSION_STATUS_TEXT[s.status] : session.error ? <span className="status-bad">not found</span> : '…'}</td>
      <td>{s ? formatDuration(s.meteredSeconds) : '—'}</td>
      <td>{s?.billingBreakdown ? <b>{formatMillimes(s.billingBreakdown.totalCents)}</b> : <span className="muted">not billed yet</span>}</td>
      <td>
        <Link to={`/sessions/${id}`}>Details »</Link>
      </td>
    </tr>
  );
}
