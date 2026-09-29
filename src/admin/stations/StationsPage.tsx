import { useRef, useState } from 'react';
import { Link } from 'react-router';

import type { Alert, CommandType, SessionView, Station } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { hasRole } from '../../auth/roles';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDuration, secondsSince, useNow } from '../../shared/format';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { useGamerNames } from '../useLookups';
import { CommandNotices } from './CommandNotices';
import { applyStatus, isOnline, screenText, stationLabel, STATIONS_PATH } from './station';
import { formatMetric, isHot } from './telemetry';
import { COMMAND_LABEL, useCommands } from './useCommands';

function Temp({ metrics, metric }: { metrics: Record<string, number> | undefined; metric: string }) {
  const value = metrics?.[metric];
  if (value === undefined) return <span className="muted">—</span>;
  return <span className={isHot(metric, value) ? 'status-bad' : ''}>{formatMetric(metric, value)}</span>;
}

export function StationsPage() {
  const { user } = useAuth();
  const { isHq, branchId, branchName, scoped, inScope } = useBranchScope();
  // One branch picked: the column would say the same thing on every row.
  const showBranch = isHq && branchId === null;
  const canBulk = hasRole(user, 'MANAGER');
  const now = useNow(10_000);

  const stations = useApiQuery<Station[]>(scoped(STATIONS_PATH));
  const sessions = useApiQuery<SessionView[]>(scoped('/sessions?status=ACTIVE'));
  const alerts = useApiQuery<Alert[]>(scoped('/alerts'));
  const gamerNames = useGamerNames();
  const games = useApiQuery<{ id: string; title: string }[]>('/games');
  // machineId -> latest metrics, from telemetry_update only (no per-row snapshot call).
  const [telemetry, setTelemetry] = useState<Record<string, Record<string, number>>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<unknown>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commands = useCommands();

  function reloadSoon() {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(stations.reload, 300);
  }

  useRealtimeEvent('station_status', (e) => {
    if (!inScope(e.branchId)) return; // HQ looking at another branch
    const current = stations.data?.find((s) => s.serialNumber === e.serialNumber);
    if (!current) {
      reloadSoon(); // a station we don't list yet (just approved, or another branch for HQ)
      return;
    }
    if (current.sessionId !== e.sessionId) sessions.reload();
    stations.setData((list) => list?.map((s) => (s.serialNumber === e.serialNumber ? applyStatus(s, e) : s)));
  });

  useRealtimeEvent('telemetry_update', (e) => setTelemetry((t) => ({ ...t, [e.machineId]: e.metrics })));
  useRealtimeEvent('alert', (e) => inScope(e.branchId) && alerts.setData((list) => [e, ...(list ?? []).filter((a) => a.id !== e.id)]));
  useRealtimeEvent('session_update', (e) => {
    if (!inScope(e.branchId)) return;
    if (e.status === 'ENDED' || !sessions.data?.some((s) => s.id === e.sessionId)) sessions.reload();
  });

  useOnReconnect(() => {
    stations.reload();
    sessions.reload();
    alerts.reload();
  });

  // The real list has no branchId yet: those rows sort (and show) without a branch.
  const branchOf = (s: Station) => (s.branchId ? branchName(s.branchId) : '—');
  const list = [...(stations.data ?? [])].sort(
    (a, b) => branchOf(a).localeCompare(branchOf(b)) || stationLabel(a).localeCompare(stationLabel(b)),
  );
  const sessionById = new Map((sessions.data ?? []).map((s) => [s.id, s]));
  const openAlerts = (machineId: string) =>
    (alerts.data ?? []).filter((a) => a.machineId === machineId && a.status !== 'RESOLVED').length;
  const stationName = (id: string) => {
    const s = stations.data?.find((x) => x.id === id);
    return s ? stationLabel(s) : id.slice(0, 8);
  };
  const gameTitle = (id: string | null) => (id ? (games.data?.find((g) => g.id === id)?.title ?? 'a game') : null);

  async function run(machineIds: string[], type: CommandType) {
    setActionError(null);
    for (const id of machineIds) {
      try {
        await commands.send(id, type);
      } catch (err) {
        setActionError(err);
      }
    }
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = list.filter((s) => selected.has(s.id)).map((s) => s.id);
  const online = list.filter(isOnline).length;
  const inSession = list.filter((s) => s.sessionId).length;

  return (
    <>
      <h1>Stations</h1>
      <ErrorBox error={stations.error ?? actionError} />
      <CommandNotices notices={commands.notices} stationName={stationName} />

      <p>
        {list.length} stations &middot; <b>{online}</b> online &middot; <b>{inSession}</b> in session
        {stations.loading && <span className="muted"> &middot; loading…</span>}
      </p>

      {canBulk && (
        <div className="toolbar">
          With selected ({selectedIds.length}):{' '}
          <button type="button" disabled={selectedIds.length === 0} onClick={() => run(selectedIds, 'LOCK')}>
            Lock
          </button>{' '}
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => {
              if (window.confirm(`Shut down ${selectedIds.length} station(s)? Any running session ends.`)) {
                void run(selectedIds, 'SHUTDOWN');
              }
            }}
          >
            Shut down
          </button>
        </div>
      )}

      <table className="grid">
        <thead>
          <tr>
            {canBulk && (
              <th>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={list.length > 0 && selectedIds.length === list.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(list.map((s) => s.id)) : new Set())}
                />
              </th>
            )}
            <th>Station</th>
            {showBranch && <th>Branch</th>}
            <th>Status</th>
            <th>Screen</th>
            <th>Session</th>
            <th>CPU</th>
            <th>GPU</th>
            <th>Alerts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => {
            const session = s.sessionId ? sessionById.get(s.sessionId) : undefined;
            const waiting = commands.pendingFor(s.id);
            const alertCount = openAlerts(s.id);
            return (
              <tr key={s.id}>
                {canBulk && (
                  <td>
                    <input type="checkbox" aria-label={`Select ${stationLabel(s)}`} checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                  </td>
                )}
                <td>
                  <Link to={`/stations/${s.id}`}>
                    <b>{stationLabel(s)}</b>
                  </Link>
                </td>
                {showBranch && <td>{branchOf(s)}</td>}
                <td className={isOnline(s) ? 'status-ok' : 'status-bad'}>{s.status}</td>
                <td>
                  {screenText(s.locked)}
                  {s.runningGameId && <div className="muted">{gameTitle(s.runningGameId)}</div>}
                </td>
                <td>
                  {s.sessionId ? (
                    <>
                      {session ? (gamerNames.get(session.userId) ?? 'gamer') : 'in session'}
                      {session && <span className="muted"> ({formatDuration(secondsSince(session.startedAt, now))})</span>}
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <Temp metrics={isOnline(s) ? telemetry[s.id] : undefined} metric="cpu.temperature_c" />
                </td>
                <td>
                  <Temp metrics={isOnline(s) ? telemetry[s.id] : undefined} metric="gpu.0.temperature_c" />
                </td>
                <td className={alertCount ? 'status-bad' : 'muted'}>{alertCount || '—'}</td>
                <td className="nowrap">
                  {waiting ? (
                    <i>{COMMAND_LABEL[waiting.type]}… waiting</i>
                  ) : (
                    <>
                      <button type="button" onClick={() => run([s.id], s.locked ? 'UNLOCK' : 'LOCK')}>
                        {s.locked ? 'Unlock' : 'Lock'}
                      </button>{' '}
                      <Link to={`/stations/${s.id}`}>Details »</Link>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {!stations.loading && list.length === 0 && (
            <tr>
              <td colSpan={10} className="muted">
                No stations yet. Approve new stations under <Link to="/enrollment">New stations</Link>.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
