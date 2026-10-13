import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';


import type {
  Alert,
  Command,
  CommandStatus,
  IssueCommandBody,
  Session,
  StationDetail,
  StationGame,
  TelemetryHistoryRow,
  TelemetrySnapshot,
} from '../../../../core/api-types';
import { useAuth } from '../../../../providers/AuthProvider';
import { hasRole } from '../../../../core/auth/roles';
import { useOnReconnect, useRealtimeEvent } from '../../../../providers/RealtimeProvider';
import { CopyButton } from '../../components/CopyButton';
import { ErrorBox } from '../../components/ErrorBox';
import { formatAgo, formatClock, formatDateTime, formatDuration, secondsSince } from '../../../../lib/format';
import { useNow } from '../../../../hooks/useNow';
import { ActionMessages } from '../../components/ActionMessages';
import { useAction } from '../../../../hooks/useAction';
import { useApiQuery } from '../../../../hooks/useApiQuery';
import { useBranchScope } from '../../providers/BranchContext';
import { alertDetail, isSevere, repeatText, typeLabel } from '../../../../domain/alerts';
import { applyCatalogStatus } from '../../../../domain/games';
import { SESSION_STATUS_TEXT } from '../../../../domain/sessions';
import { CommandError } from '../../components/CommandError';
import {
  applyStatus,
  bookingLink,
  isOnline,
  peripheralName,
  screenText,
  shutdownConfirmText,
  sortPeripherals,
  stationLabel,
} from '../../../../domain/stations';
import { appendReading, describeMetric, formatMetric, isHot, sortedMetrics, summarize } from '../../../../domain/telemetry';
import { COMMAND_LABEL, isOpen, useCommands } from '../../hooks/useCommands';
import { EmptyRow } from '../../components/EmptyRow';
import { alertsService } from '../../../../services/alerts.service';
import { sessionsService } from '../../../../services/sessions.service';
import { stationsService } from '../../../../services/stations.service';
import { Select } from '../../../../components/primitives/Select';

/** Telemetry history spans the desk can pick (the server keeps up to 48 hours). */
const HISTORY_HOURS = [1, 6, 24, 48];

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

  const station = useApiQuery<StationDetail>(stationsService.paths.one(id));
  // 404 TELEMETRY_NOT_AVAILABLE once the server's cache expired: shown as "no reading", not an error.
  const snapshot = useApiQuery<TelemetrySnapshot>(stationsService.paths.telemetry(id));
  // Resolved catalog + what the agent last reported: only installed games can be launched.
  const games = useApiQuery<StationGame[]>(stationsService.paths.games(id));
  const log = useApiQuery<Command[]>(stationsService.paths.commands(id, LOG_SIZE));
  // The API filters alerts by branch, not by station: take the station's branch and keep this station's rows.
  const alertBranch = station.data?.branchId;
  const alerts = useApiQuery<Alert[]>(alertBranch ? alertsService.paths.list({ branchId: alertBranch }) : null);
  const sessionId = station.data?.sessionId ?? null;
  const session = useApiQuery<Session>(sessionId ? sessionsService.paths.one(sessionId) : null);
  const [runoutWarned, setRunoutWarned] = useState<string | null>(null);
  const { isHq, branchName, reloadMachines } = useBranchScope();
  const { user } = useAuth();
  // Rename and Shut down: branch admin and up (the server refuses staff).
  const canManage = hasRole(user, 'MANAGER');
  const renaming = useAction();
  const [newName, setNewName] = useState<string | null>(null);

  const [hours, setHours] = useState(6);
  // One sample a minute from the database, oldest first; live readings are added on this page.
  const history = useApiQuery<TelemetryHistoryRow[]>(stationsService.paths.telemetryHistory(id, hours));
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
    const reading = { recordedAt: e.timestamp || new Date().toISOString(), metrics: e.metrics };
    history.setData((rows) => rows && appendReading(rows, reading, Date.now() - hours * 3_600_000));
  });
  const upsertAlert = (e: Alert) => {
    if (e.machineId !== id) return;
    alerts.setData((list) => (list?.some((a) => a.id === e.id) ? list.map((a) => (a.id === e.id ? e : a)) : [e, ...(list ?? [])]));
  };
  useRealtimeEvent('alert', upsertAlert);
  useRealtimeEvent('catalog_status', (e) => e.machineId === id && games.setData((list) => applyCatalogStatus(list, e)));
  useRealtimeEvent('alert_resolved', upsertAlert);
  useRealtimeEvent('session_runout_warning', (e) => e.machineId === id && setRunoutWarned(e.sessionId));
  useRealtimeEvent('peripheral_status', (e) => {
    if (e.machineId !== id) return;
    station.setData((st) => st && { ...st, peripherals: e.peripherals, peripheralsReportedAt: e.reportedAt });
  });
  useOnReconnect(() => {
    station.reload();
    snapshot.reload();
    history.reload();
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

  // PATCH /api/v1/stations/:id (branch admin and up): the agent's own name no longer overrides it.
  async function rename(e: FormEvent) {
    e.preventDefault();
    if (newName === null) return;
    const updated = await renaming.run(
      'rename',
      () => stationsService.rename(id, newName.trim()),
      (x) => `Station renamed to ${stationLabel(x)}.`,
    );
    if (!updated) return;
    station.setData(() => updated);
    setNewName(null);
    reloadMachines();
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
  const live = online && snapshot.data ? snapshot.data.metrics : {};
  const summary = summarize(history.data ?? []);
  // Every sensor that has a live value or a history; an offline station still shows its history.
  const sensors = sortedMetrics({ ...Object.fromEntries([...summary].map(([m, x]) => [m, x.avg])), ...live }).map(([m]) => m);
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
      <CommandError error={actionError} stationName={name} />
      <ActionMessages action={renaming} />

      <table className="kv">
        <tbody>
          <tr>
            <th>Name</th>
            <td>
              {newName === null ? (
                <>
                  <b>{name}</b>{' '}
                  {canManage && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        renaming.clear();
                        setNewName(s.name ?? '');
                      }}
                    >
                      Rename
                    </button>
                  )}
                </>
              ) : (
                <form onSubmit={rename} style={{ display: 'inline' }}>
                  <input
                    aria-label="New station name"
                    required
                    maxLength={64}
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />{' '}
                  <button type="submit" disabled={renaming.busy === 'rename' || !newName.trim()}>
                    Save
                  </button>{' '}
                  <button type="button" className="secondary" onClick={() => setNewName(null)}>
                    Cancel
                  </button>
                </form>
              )}
            </td>
          </tr>
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
          className="danger"
          disabled={busy || !canManage}
          title={canManage ? '' : 'Only a branch admin can shut a station down'}
          onClick={() => window.confirm(shutdownConfirmText(name, Boolean(s.sessionId))) && run({ type: 'SHUTDOWN' })}
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
        <Select
          aria-label="Game to launch"
          value={gameId}
          onChange={setGameId}
          placeholder="— choose a game —"
          options={(games.data ?? []).map((g) => ({
            value: g.gameId,
            label: `${g.name}${g.installed === null ? ' (not reported yet)' : g.installed ? '' : ' (not installed)'}`,
            disabled: g.installed !== true,
          }))}
        />{' '}
        <button type="button" disabled={busy || !gameId} onClick={() => run({ type: 'LAUNCH_GAME', gameId })}>
          Launch game
        </button>
        {waiting && <i> &nbsp; {COMMAND_LABEL[waiting.type]}… waiting for the station</i>}
      </div>

      <h2>Telemetry</h2>
      <div className="toolbar">
        <label htmlFor="t-hours">Min / avg / max over the last</label>{' '}
        <Select id="t-hours" value={String(hours)} onChange={(v) => setHours(Number(v))} options={HISTORY_HOURS.map((h) => ({ value: String(h), label: `${h} ${h === 1 ? 'hour' : 'hours'}` }))} />
        {history.loading && <span className="muted"> loading…</span>}
        <span className="muted">
          {' '}
          &middot; {online ? (snapshot.data ? `last reading at ${formatClock(snapshot.data.timestamp)}` : 'waiting for the first reading…') : 'station is offline'}
        </span>
      </div>
      <ErrorBox error={history.error} />
      {sensors.length === 0 ? (
        <p className="muted">{history.loading ? 'Loading…' : `No reading in the last ${hours} ${hours === 1 ? 'hour' : 'hours'}.`}</p>
      ) : (
        <table className="grid" style={{ width: 'auto' }}>
          <thead>
            <tr>
              <th>Sensor</th>
              <th>Now</th>
              <th>Min</th>
              <th>Avg</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((metric) => {
              const value = live[metric];
              const r = summary.get(metric);
              return (
                <tr key={metric}>
                  <td>{describeMetric(metric).label}</td>
                  {value !== undefined ? (
                    <td className={isHot(metric, value) ? 'status-bad' : 'status-ok'}>{formatMetric(metric, value)}</td>
                  ) : (
                    <td className="muted">—</td>
                  )}
                  <td>{r ? formatMetric(metric, r.min) : '—'}</td>
                  <td>{r ? formatMetric(metric, r.avg) : '—'}</td>
                  <td className={r && isHot(metric, r.max) ? 'status-bad' : ''}>{r ? formatMetric(metric, r.max) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2>Peripherals {s.peripheralsReportedAt && <span className="muted">(reported {formatAgo(s.peripheralsReportedAt, now)})</span>}</h2>
      {s.peripherals === null ? (
        <p className="muted">This station hasn&apos;t reported its peripherals yet.</p>
      ) : s.peripherals.length === 0 ? (
        <p className="muted">No watched peripheral on this station.</p>
      ) : (
        <table className="grid" style={{ width: 'auto' }}>
          <thead>
            <tr>
              <th>Device</th>
              <th>Vendor / product</th>
              <th>State</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {sortPeripherals(s.peripherals).map((p) => (
              <tr key={p.deviceId}>
                <td title={p.deviceId}>{peripheralName(p)}</td>
                <td>{p.vendorProductId ? <code>{p.vendorProductId}</code> : <span className="muted">—</span>}</td>
                <td className={p.connected ? 'status-ok' : 'status-bad'}>{p.connected ? 'Connected' : 'Disconnected'}</td>
                <td>{p.changedAt ? formatDateTime(p.changedAt) : <span className="muted">—</span>}</td>
              </tr>
            ))}
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
            <EmptyRow colSpan={4}>No commands sent to this station yet.</EmptyRow>
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
            <EmptyRow colSpan={5}>No alerts for this station.</EmptyRow>
          )}
        </tbody>
      </table>
      <p>
        <Link to="/alerts">All alerts »</Link>
      </p>
    </>
  );
}
