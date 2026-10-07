import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { Alert, AlertCategory, AlertSeverity, AlertStatus } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { formatAgo, formatDateTime, useNow } from '../../shared/lib/format';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { useBranchScope } from '../branches/BranchContext';
import { useStationNames } from '../stations/useStationNames';
import { useAlertFeed } from './AlertFeedContext';
import { ALERTS_PATH, alertDetail, CATEGORY_LABEL, isSevere, repeatText, SEVERITIES, typeLabel } from './labels';
import { EmptyRow } from '../../shared/components/EmptyRow';

type StatusFilter = AlertStatus | 'all';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

/** Newest first; the server caps a list at 500. */
const LIMIT = 500;

function matches(a: Alert, status: StatusFilter, category: string, severity: string): boolean {
  if (status === 'open' && a.acknowledged) return false;
  if (status === 'resolved' && !a.acknowledged) return false;
  return (!category || a.category === category) && (!severity || a.severity === severity);
}

export function AlertsPage() {
  const { isHq, branchId, branchName, scoped, inScope } = useBranchScope();
  const showBranch = isHq && branchId === null;
  const now = useNow(15_000);
  const feed = useAlertFeed();
  const stationNames = useStationNames();

  const [status, setStatus] = useState<StatusFilter>('open');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  // The server filters by status (and HQ's branch); category and severity are filtered here.
  const alerts = useApiQuery<Alert[]>(scoped(`${ALERTS_PATH}?limit=${LIMIT}${status === 'all' ? '' : `&status=${status}`}`));

  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  // Looking at this page counts as seeing the banner's alerts; they stay tagged NEW here.
  const { unseen, dismissAll } = feed;
  useEffect(() => {
    if (!unseen.length) return;
    setFresh((f) => new Set([...f, ...unseen.map((a) => a.id)]));
    dismissAll();
  }, [unseen, dismissAll]);

  /** Put a new or changed alert in the list, or drop it if the status filter no longer matches. */
  function upsert(a: Alert) {
    alerts.setData((list) => {
      const rest = (list ?? []).filter((x) => x.id !== a.id);
      if (status === 'open' && a.acknowledged) return rest;
      if (status === 'resolved' && !a.acknowledged) return rest;
      const at = list?.findIndex((x) => x.id === a.id) ?? -1;
      if (at < 0) return [a, ...rest];
      const next = [...(list ?? [])];
      next[at] = a; // a resolve keeps the row where it was
      return next;
    });
  }

  useRealtimeEvent('alert', (a) => {
    if (!inScope(a.branchId)) return;
    upsert(a);
    setFresh((f) => new Set(f).add(a.id));
  });
  useRealtimeEvent('alert_resolved', (a) => inScope(a.branchId) && upsert(a));
  useOnReconnect(alerts.reload);

  async function resolve(a: Alert) {
    setBusy(a.id);
    setError(null);
    try {
      const updated = await api<Alert>('POST', `${ALERTS_PATH}/${a.id}/resolve`);
      upsert(updated);
      feed.update(updated);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  const list = (alerts.data ?? []).filter((a) => matches(a, status, category, severity));

  return (
    <>
      <h1>Alerts</h1>
      <p>
        Hardware warnings, anti-theft (device unplugged) and security violations reported by the stations.{' '}
        <b>{feed.openCount}</b> open.
      </p>
      <ErrorBox error={alerts.error ?? error} />

      <div className="toolbar">
        <label htmlFor="f-status">Status</label>
        <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="sep-v" />
        <label htmlFor="f-category">Category</label>
        <select id="f-category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All</option>
          {(Object.keys(CATEGORY_LABEL) as AlertCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <span className="sep-v" />
        <label htmlFor="f-severity">Severity</label>
        <select id="f-severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All</option>
          {SEVERITIES.map((s: AlertSeverity) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>{' '}
        <button type="button" className="secondary" onClick={alerts.reload}>
          Refresh
        </button>
        {alerts.loading && <span className="muted"> loading…</span>}
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>When</th>
            <th>Station</th>
            {showBranch && <th>Branch</th>}
            <th>Category</th>
            <th>Alert</th>
            <th>Severity</th>
            <th>Detail</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id} className={a.acknowledged ? 'row-muted' : ''}>
              <td className="nowrap">
                {formatDateTime(a.createdAt)}
                <div className="muted">{formatAgo(a.createdAt, now)}</div>
              </td>
              <td>
                <Link to={`/stations/${a.machineId}`}>
                  {stationNames.get(a.machineId) ?? a.serialNumber ?? a.machineId.slice(0, 8)}
                </Link>
              </td>
              {showBranch && <td>{a.branchId ? branchName(a.branchId) : '—'}</td>}
              <td>{CATEGORY_LABEL[a.category] ?? a.category}</td>
              <td>
                {typeLabel(a.type)}
                {fresh.has(a.id) && !a.acknowledged && <span className="new-tag">NEW</span>}
              </td>
              <td className={isSevere(a.severity) ? 'status-bad' : ''}>{a.severity}</td>
              <td>
                {alertDetail(a)} {repeatText(a) && <b>{repeatText(a)}</b>}
              </td>
              <td className={a.acknowledged ? '' : 'status-ok'}>
                {a.acknowledged ? (
                  <>
                    Resolved
                    {a.acknowledgedAt && <div className="muted">{formatDateTime(a.acknowledgedAt)}</div>}
                  </>
                ) : (
                  'Open'
                )}
              </td>
              <td className="nowrap">
                {busy === a.id ? (
                  <i>working…</i>
                ) : a.acknowledged ? (
                  <span className="muted">—</span>
                ) : (
                  <button type="button" onClick={() => resolve(a)}>
                    Resolve
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!alerts.loading && list.length === 0 && (
            <EmptyRow colSpan={9}>No alerts match these filters.</EmptyRow>
          )}
        </tbody>
      </table>
    </>
  );
}
