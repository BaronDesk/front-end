import { useState } from 'react';
import { Link, useParams } from 'react-router';

import type { Alert, CommandLog, CommandType, Game, SessionView, StationDetail, TelemetrySample } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatAgo, formatClock, formatDateTime, formatDuration, secondsSince, useNow } from '../../shared/format';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { useGamerNames } from '../useLookups';
import { applyStatus, isOnline, screenText, stationLabel, STATIONS_PATH } from './station';
import { describeMetric, formatMetric, isHot } from './telemetry';
import { COMMAND_LABEL, useCommands } from './useCommands';

/** How much telemetry history the page keeps in memory (brief §6: no DB history call). */
const HISTORY_MS = 5 * 60_000;

const STATUS_TEXT: Record<CommandLog['status'], string> = {
  PENDING: 'waiting…',
  ACKED: 'done',
  NACKED: 'refused',
  TIMEOUT: 'no response',
};

export function StationDetailPage() {
  const { id = '' } = useParams();
  const now = useNow(5_000);

  const station = useApiQuery<StationDetail>(`${STATIONS_PATH}/${id}`);
  const snapshot = useApiQuery<TelemetrySample[]>(`/stations/${id}/telemetry`);
  const games = useApiQuery<Game[]>(`/stations/${id}/games`);
  const log = useApiQuery<CommandLog[]>(`/commands?machineId=${id}`);
  const alerts = useApiQuery<Alert[]>(`/alerts?machineId=${id}`);
  const sessionId = station.data?.sessionId ?? null;
  const session = useApiQuery<SessionView>(sessionId ? `/sessions/${sessionId}` : null);
  const gamerNames = useGamerNames();
  const { isHq, branchName } = useBranchScope();

  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [gameId, setGameId] = useState('');
  const [actionError, setActionError] = useState<unknown>(null);

  const commands = useCommands((r) => {
    if (r.machineId !== id) return;
    log.setData((rows) =>
      rows?.map((c) =>
        c.id === r.commandId ? { ...c, status: r.status, code: r.code, reason: r.reason, completedAt: new Date().toISOString() } : c,
      ),
    );
  });

  useRealtimeEvent('station_status', (e) => {
    station.setData((s) => (s && s.serialNumber === e.serialNumber ? applyStatus(s, e) : s));
  });
  useRealtimeEvent('telemetry_update', (e) => {
    if (e.machineId !== id) return;
    snapshot.setData(() => e.samples);
    const cutoff = Date.now() - HISTORY_MS;
    setHistory((h) => [...h.filter((x) => Date.parse(x.sampledAt) >= cutoff), ...e.samples]);
  });
  useRealtimeEvent('alert', (e) => {
    if (e.machineId === id) alerts.setData((list) => [e, ...(list ?? [])]);
  });
  useRealtimeEvent('session_update', (e) => {
    if (e.machineId === id && e.sessionId === sessionId) session.reload();
  });
  useOnReconnect(() => {
    station.reload();
    snapshot.reload();
    log.reload();
    alerts.reload();
  });

  async function run(type: CommandType, payload: Record<string, unknown> = {}) {
    setActionError(null);
    try {
      const cmd = await commands.send(id, type, payload);
      log.setData((rows) => [cmd, ...(rows ?? []).filter((c) => c.id !== cmd.id)]);
    } catch (err) {
      setActionError(err);
    }
  }

  const s = station.data;
  if (station.error && !s) {
    return (
      <>
        <h1>Station</h1>
        <ErrorBox error={station.error} />
        <Link to="/stations">« Back to stations</Link>
      </>
    );
  }
  if (!s) return <p className="muted">Loading…</p>;

  const waiting = commands.pendingFor(id);
  const busy = Boolean(waiting);
  const online = isOnline(s);
  const name = stationLabel(s);
  const samples = [...(online ? (snapshot.data ?? []) : [])].sort(
    (a, b) => describeMetric(a.metric).order - describeMetric(b.metric).order,
  );
  const range = (metric: string) => {
    const values = history.filter((x) => x.metric === metric).map((x) => x.value);
    return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  };
  const gameTitle = (gid: string | null) => (gid ? (games.data?.find((g) => g.id === gid)?.title ?? 'unknown game') : '—');

  return (
    <>
      <p>
        <Link to="/stations">« Back to stations</Link>
      </p>
      <h1>Station {name}</h1>
      <ErrorBox error={actionError} />

      <table className="kv">
        <tbody>
          <tr>
            <th>Status</th>
            <td className={online ? 'status-ok' : 'status-bad'}>
              {s.status} <span className="muted">(last seen {formatAgo(s.lastSeen, now)})</span>
            </td>
          </tr>
          <tr>
            <th>Screen</th>
            <td>
              {screenText(s.locked)}
              {s.leaseExpiresAt && <span className="muted"> (lease until {formatClock(s.leaseExpiresAt)})</span>}
            </td>
          </tr>
          <tr>
            <th>Session</th>
            <td>
              {s.sessionId && session.data ? (
                <>
                  {gamerNames.get(session.data.userId) ?? 'gamer'} since {formatClock(session.data.startedAt)} (
                  {formatDuration(secondsSince(session.data.startedAt, now))}) &middot; running cost{' '}
                  <b>{session.data.estimatedCost.toFixed(3)}</b> &middot; balance left <b>{session.data.balance.toFixed(3)}</b>
                  {session.data.status === 'WARNED' && <span className="status-bad"> &middot; LOW BALANCE</span>}
                </>
              ) : s.sessionId ? (
                'in session'
              ) : (
                <span className="muted">none</span>
              )}
            </td>
          </tr>
          <tr>
            <th>Running game</th>
            <td>{gameTitle(s.runningGameId)}</td>
          </tr>
          {isHq && (
            <tr>
              <th>Branch</th>
              <td>{branchName(s.branchId)}</td>
            </tr>
          )}
          <tr>
            <th>Serial / IP</th>
            <td>
              <code>{s.serialNumber}</code> / {s.ip ?? '—'}
            </td>
          </tr>
          <tr>
            <th>Enrollment</th>
            <td>{s.enrollmentStatus}</td>
          </tr>
        </tbody>
      </table>

      <h2>Remote commands</h2>
      <div className="toolbar">
        <button type="button" disabled={busy} onClick={() => run('LOCK')}>
          Lock
        </button>{' '}
        <button type="button" disabled={busy} onClick={() => run('UNLOCK')}>
          Unlock
        </button>{' '}
        <button
          type="button"
          disabled={busy}
          onClick={() => window.confirm(`Shut down ${name}?${s.sessionId ? ' The running session ends.' : ''}`) && run('SHUTDOWN')}
        >
          Shut down
        </button>{' '}
        <button
          type="button"
          disabled={busy || !s.sessionId}
          title={s.sessionId ? '' : 'No session on this station'}
          onClick={() => window.confirm(`End the session on ${name} and bill it now?`) && run('END_SESSION')}
        >
          End session
        </button>
        <span className="sep-v" />
        <select value={gameId} onChange={(e) => setGameId(e.target.value)} aria-label="Game to launch">
          <option value="">— choose a game —</option>
          {(games.data ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>{' '}
        <button type="button" disabled={busy || !gameId} onClick={() => run('LAUNCH_GAME', { gameId })}>
          Launch game
        </button>
        {waiting && <i> &nbsp; {COMMAND_LABEL[waiting.type]}… waiting for the station</i>}
      </div>

      <h2>Telemetry {online && <span className="muted">(live, min/max over the last 5 minutes on this page)</span>}</h2>
      {samples.length === 0 ? (
        <p className="muted">{online ? 'Waiting for the first reading…' : 'Station is offline.'}</p>
      ) : (
        <table className="grid" style={{ width: 'auto' }}>
          <thead>
            <tr>
              <th>Sensor</th>
              <th>Now</th>
              <th>Min</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((x) => {
              const r = range(x.metric);
              return (
                <tr key={x.metric}>
                  <td>{describeMetric(x.metric).label}</td>
                  <td className={isHot(x.metric, x.value) ? 'status-bad' : 'status-ok'}>{formatMetric(x.metric, x.value)}</td>
                  <td>{r ? formatMetric(x.metric, r.min) : '—'}</td>
                  <td>{r ? formatMetric(x.metric, r.max) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2>Command log</h2>
      <table className="grid">
        <thead>
          <tr>
            <th>Sent</th>
            <th>Command</th>
            <th>Result</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {(log.data ?? []).slice(0, 20).map((c) => (
            <tr key={c.id}>
              <td>{formatClock(c.issuedAt)}</td>
              <td>
                {COMMAND_LABEL[c.type]}
                {c.type === 'LAUNCH_GAME' && ` (${gameTitle(String(c.payload.gameId ?? ''))})`}
              </td>
              <td className={c.status === 'ACKED' ? 'status-ok' : c.status === 'PENDING' ? '' : 'status-bad'}>{STATUS_TEXT[c.status]}</td>
              <td>
                {c.reason ?? ''}
                {c.code && <span className="muted"> ({c.code})</span>}
              </td>
            </tr>
          ))}
          {(log.data ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No commands sent to this station yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Recent alerts</h2>
      <table className="grid">
        <thead>
          <tr>
            <th>When</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Detail</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(alerts.data ?? []).slice(0, 10).map((a) => (
            <tr key={a.id}>
              <td>{formatDateTime(a.occurredAt)}</td>
              <td>{a.type}</td>
              <td className={a.severity === 'HIGH' || a.severity === 'CRITICAL' ? 'status-bad' : ''}>{a.severity}</td>
              <td>{a.detail}</td>
              <td>{a.status}</td>
            </tr>
          ))}
          {(alerts.data ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No alerts for this station.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p>
        <Link to="/alerts">All alerts »</Link>
      </p>
    </>
  );
}
