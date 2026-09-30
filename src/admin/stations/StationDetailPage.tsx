import { useState } from 'react';
import { Link, useParams } from 'react-router';

import type { Alert, Command, CommandStatus, IssueCommandBody, Session, StationDetail, StationGame, TelemetrySnapshot } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { CopyButton } from '../../shared/CopyButton';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatAgo, formatClock, formatDateTime, formatDuration, secondsSince, useNow } from '../../shared/format';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { ALERTS_PATH, alertDetail, isSevere, repeatText, typeLabel } from '../alerts/labels';
import { applyCatalogStatus } from '../games/games';
import { SESSION_STATUS_TEXT } from '../sessions/labels';
import { applyStatus, bookingLink, isOnline, screenText, stationLabel, STATIONS_PATH } from './station';
import { describeMetric, formatMetric, isHot, sortedMetrics } from './telemetry';
import { COMMAND_LABEL, isOpen, useCommands } from './useCommands';

/** How much telemetry history the page keeps in memory (brief §6: no DB history call). */
const HISTORY_MS = 5 * 60_000;

/** One telemetry_update seen on this page, for the min/max columns. */
interface Reading {
  at: number;
  metrics: Record<string, number>;
}

const STATUS_TEXT: Record<CommandStatus, string> = {
  PENDING: 'queued…',
  SENT: 'sent, waiting…',
  ACKED: 'accepted',
  NACKED: 'refused',
  FAILED: 'failed',
  TIMEOUT: 'no response',
};

const LOG_SIZE = 20;

export function StationDetailPage() {
  const { id = '' } = useParams();
  const now = useNow(5_000);

  const station = useApiQuery<StationDetail>(`${STATIONS_PATH}/${id}`);
  // 404 TELEMETRY_NOT_AVAILABLE once the server's cache expired: shown as "no reading", not an error.
  const snapshot = useApiQuery<TelemetrySnapshot>(`${STATIONS_PATH}/${id}/telemetry`);
  // Resolved catalog + what the agent last reported: only installed games can be launched.
  const games = useApiQuery<StationGame[]>(`${STATIONS_PATH}/${id}/games`);
  const log = useApiQuery<Command[]>(`${STATIONS_PATH}/${id}/commands?limit=${LOG_SIZE}`);
  // The API filters alerts by branch, not by station: take the station's branch and keep this station's rows.
  const alertBranch = station.data?.branchId;
  const alerts = useApiQuery<Alert[]>(alertBranch ? `${ALERTS_PATH}?branchId=${alertBranch}&limit=500` : null);
  const sessionId = station.data?.sessionId ?? null;
  const session = useApiQuery<Session>(sessionId ? `/sessions/${sessionId}` : null);
  const [runoutWarned, setRunoutWarned] = useState<string | null>(null);
  const { isHq, branchName } = useBranchScope();

  const [history, setHistory] = useState<Reading[]>([]);
  const [gameId, setGameId] = useState('');
  const [actionError, setActionError] = useState<unknown>(null);

  // Every command_update for this station (ours, other staff's, automatic CATALOG_UPDATEs) lands in the log.
  const commands = useCommands((c) => {
    if (c.machineId !== id) return;
    log.setData((rows) => [c, ...(rows ?? []).filter((x) => x.commandId !== c.commandId)].slice(0, LOG_SIZE));
  });

  useRealtimeEvent('station_status', (e) => {
    station.setData((s) => (s && s.serialNumber === e.serialNumber ? applyStatus(s, e) : s));
  });
  useRealtimeEvent('telemetry_update', (e) => {
    if (e.machineId !== id) return;
    snapshot.setData(() => e);
    const at = Date.parse(e.timestamp) || Date.now();
    const cutoff = Date.now() - HISTORY_MS;
    setHistory((h) => [...h.filter((x) => x.at >= cutoff), { at, metrics: e.metrics }]);
  });
  const upsertAlert = (e: Alert) => {
    if (e.machineId !== id) return;
    alerts.setData((list) => (list?.some((a) => a.id === e.id) ? list.map((a) => (a.id === e.id ? e : a)) : [e, ...(list ?? [])]));
  };
  useRealtimeEvent('alert', upsertAlert);
  useRealtimeEvent('catalog_status', (e) => e.machineId === id && games.setData((list) => applyCatalogStatus(list, e)));
  useRealtimeEvent('alert_resolved', upsertAlert);
  useRealtimeEvent('session_runout_warning', (e) => e.machineId === id && setRunoutWarned(e.sessionId));
  useOnReconnect(() => {
    station.reload();
    snapshot.reload();
    log.reload();
    alerts.reload();
    games.reload();
  });

  async function run(body: IssueCommandBody) {
    setActionError(null);
    try {
      const cmd = await commands.send(id, body);
      // Keep a newer status that command_update may already have written.
      log.setData((rows) =>
        rows?.some((c) => c.commandId === cmd.commandId) ? rows : [cmd, ...(rows ?? [])].slice(0, LOG_SIZE),
      );
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
  const readings = online && snapshot.data ? sortedMetrics(snapshot.data.metrics) : [];
  const range = (metric: string) => {
    const values = history.map((x) => x.metrics[metric]).filter((v): v is number => v !== undefined);
    return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  };
  const stationAlerts = (alerts.data ?? []).filter((a) => a.machineId === id).slice(0, 10);
  // runningGameId is the wire gameId; a command's gameId is the game's row id.
  const runningName = (wire: string | null) => (wire ? (games.data?.find((g) => g.gameId === wire)?.name ?? wire) : '—');
  const gameName = (rowId: string) => games.data?.find((g) => g.id === rowId)?.name ?? 'unknown game';

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
                  {SESSION_STATUS_TEXT[session.data.status]}
                  {session.data.startTime && (
                    <>
                      {' '}
                      since {formatClock(session.data.startTime)} ({formatDuration(secondsSince(session.data.startTime, now))})
                    </>
                  )}{' '}
                  &middot; <Link to={`/sessions/${session.data.id}`}>session and bill »</Link>
                  {runoutWarned === session.data.id && <span className="status-bad"> &middot; BALANCE RUNS OUT SOON</span>}
                </>
              ) : s.sessionId ? (
                <Link to={`/sessions/${s.sessionId}`}>in session »</Link>
              ) : (
                <span className="muted">none</span>
              )}
            </td>
          </tr>
          <tr>
            <th>Running game</th>
            <td>{runningName(s.runningGameId)}</td>
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
          <tr>
            <th>Booking link</th>
            <td>
              <CopyButton text={bookingLink(s)} label="Copy the gamers' booking link" />{' '}
              <span className="muted">(print it as a QR code on the PC: the app books this station)</span>
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Remote commands</h2>
      <div className="toolbar">
        <button type="button" disabled={busy} onClick={() => run({ type: 'LOCK' })}>
          Lock
        </button>{' '}
        <button type="button" disabled={busy} onClick={() => run({ type: 'UNLOCK' })}>
          Unlock
        </button>{' '}
        <button
          type="button"
          disabled={busy}
          onClick={() => window.confirm(`Shut down ${name}?${s.sessionId ? ' The running session ends.' : ''}`) && run({ type: 'SHUTDOWN' })}
        >
          Shut down
        </button>{' '}
        <button
          type="button"
          disabled={busy || !s.sessionId}
          title={s.sessionId ? '' : 'No session on this station'}
          onClick={() => window.confirm(`End the session on ${name} and bill it now?`) && run({ type: 'END_SESSION' })}
        >
          End session
        </button>
        <span className="sep-v" />
        <select value={gameId} onChange={(e) => setGameId(e.target.value)} aria-label="Game to launch">
          <option value="">— choose a game —</option>
          {(games.data ?? []).map((g) => (
            <option key={g.id} value={g.gameId} disabled={g.installed !== true}>
              {g.name}
              {g.installed === null ? ' (not reported yet)' : g.installed ? '' : ' (not installed)'}
            </option>
          ))}
        </select>{' '}
        <button type="button" disabled={busy || !gameId} onClick={() => run({ type: 'LAUNCH_GAME', gameId })}>
          Launch game
        </button>
        {waiting && <i> &nbsp; {COMMAND_LABEL[waiting.type]}… waiting for the station</i>}
      </div>

      <h2>Telemetry {online && <span className="muted">(live, min/max over the last 5 minutes on this page)</span>}</h2>
      {online && snapshot.data && (
        <p className="muted">Last reading at {formatClock(snapshot.data.timestamp)}.</p>
      )}
      {readings.length === 0 ? (
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
            {readings.map(([metric, value]) => {
              const r = range(metric);
              return (
                <tr key={metric}>
                  <td>{describeMetric(metric).label}</td>
                  <td className={isHot(metric, value) ? 'status-bad' : 'status-ok'}>{formatMetric(metric, value)}</td>
                  <td>{r ? formatMetric(metric, r.min) : '—'}</td>
                  <td>{r ? formatMetric(metric, r.max) : '—'}</td>
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
          {(log.data ?? []).map((c) => (
            <tr key={c.commandId}>
              <td>{formatClock(c.issuedAt)}</td>
              <td>
                {COMMAND_LABEL[c.type]}
                {c.type === 'LAUNCH_GAME' && c.gameId && ` (${gameName(c.gameId)})`}
              </td>
              <td className={c.status === 'ACKED' ? 'status-ok' : isOpen(c.status) ? '' : 'status-bad'}>
                {STATUS_TEXT[c.status]}
                {c.attempts > 1 && <span className="muted"> ({c.attempts} tries)</span>}
              </td>
              <td>
                {c.nackReason ?? c.failureReason ?? ''}
                {c.nackCode && <span className="muted"> ({c.nackCode})</span>}
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
          {stationAlerts.map((a) => (
            <tr key={a.id} className={a.acknowledged ? 'row-muted' : ''}>
              <td>{formatDateTime(a.createdAt)}</td>
              <td>{typeLabel(a.type)}</td>
              <td className={isSevere(a.severity) ? 'status-bad' : ''}>{a.severity}</td>
              <td>
                {alertDetail(a)} {repeatText(a) && <b>{repeatText(a)}</b>}
              </td>
              <td>{a.acknowledged ? 'Resolved' : 'Open'}</td>
            </tr>
          ))}
          {stationAlerts.length === 0 && (
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
