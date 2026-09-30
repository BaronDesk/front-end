import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { Command, Session, StartedSession, Station } from '../../api/types';
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
 * Session & Financial Control at the desk (brief §6.6). The backend starts a
 * session from a booking (the gamer books in the portal; a walk-in is a
 * booking starting now) and answers with a one-time PIN the gamer types on
 * the station's lock screen. There is no list of sessions on the API, so
 * "running now" is every station that reports a session, and the desk keeps
 * the sessions it started (this browser only) to find their bills.
 */
export function SessionsPage() {
  const action = useAction();
  const { inScope } = useBranchScope();
  const stations = useStationList();
  const stationNames = useStationNames();
  const recent = useRecentSessions();
  const [code, setCode] = useState('');
  const [started, setStarted] = useState<StartedSession | null>(null);
  const [warnings, setWarnings] = useState<{ sessionId: string; machineId: string; at: string }[]>([]);

  useRealtimeEvent('station_status', (e) => {
    if (!inScope(e.branchId)) return;
    stations.setData((list) => list?.map((s) => (s.serialNumber === e.serialNumber ? applyStatus(s, e) : s)));
  });
  useRealtimeEvent('session_runout_warning', (e) =>
    setWarnings((w) => [{ ...e, at: new Date().toISOString() }, ...w.filter((x) => x.sessionId !== e.sessionId)].slice(0, 5)),
  );
  useOnReconnect(stations.reload);

  async function start(e: FormEvent) {
    e.preventDefault();
    const reservationId = code.trim();
    const session = await action.run(
      'start',
      () => api<StartedSession>('POST', '/sessions', { reservationId }),
      'Session created. Give the gamer the PIN: the station unlocks when it is typed on the lock screen.',
    );
    if (session) {
      setStarted(session);
      recent.add(session.id);
      setCode('');
    }
  }

  const running = (stations.data ?? []).filter((s) => s.sessionId);

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

      <form onSubmit={start}>
        <fieldset>
          <legend>Start a session</legend>
          <p className="muted">
            The gamer books the station in the BaronDesk app (or picks <i>Play now</i> for a walk-in) and shows you the booking code.
          </p>
          <div className="form-row">
            <label htmlFor="s-code">Booking code</label>
            <input
              id="s-code"
              required
              size={40}
              placeholder="e.g. 3f2c9a1e-…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              title="The booking code shown in the gamer's app"
            />{' '}
            <button type="submit" disabled={action.busy === 'start'}>
              Start session
            </button>
          </div>
        </fieldset>
      </form>

      {started && (
        <div className="msg">
          <b>PIN for the lock screen:</b> <span className="pin">{started.pin}</span>
          <div className="muted">
            Shown once. The session starts when the gamer types it on the station. <Link to={`/sessions/${started.id}`}>Session »</Link>{' '}
            <button type="button" className="secondary" onClick={() => setStarted(null)}>
              Hide
            </button>
          </div>
        </div>
      )}

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

      <h2>Started at this desk</h2>
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
