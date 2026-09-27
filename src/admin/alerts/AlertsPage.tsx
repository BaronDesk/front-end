import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { Alert, AlertCategory, AlertSeverity } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatAgo, formatDateTime, useNow } from '../../shared/format';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { useStationNames } from '../useLookups';
import { useAlertFeed } from './AlertFeedContext';
import { CATEGORY_LABEL, isSevere, SEVERITIES, STATUS_LABEL, typeLabel } from './labels';

type StatusFilter = 'UNRESOLVED' | 'OPEN' | 'ACKED' | 'RESOLVED' | 'ALL';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'UNRESOLVED', label: 'Not resolved' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ALL', label: 'All' },
];

function matches(a: Alert, status: StatusFilter, category: string, severity: string): boolean {
  if (status === 'UNRESOLVED' && a.status === 'RESOLVED') return false;
  if (status !== 'UNRESOLVED' && status !== 'ALL' && a.status !== status) return false;
  return (!category || a.category === category) && (!severity || a.severity === severity);
}

export function AlertsPage() {
  const { isHq, branchId, branchName, scoped, inScope } = useBranchScope();
  const showBranch = isHq && branchId === null;
  const now = useNow(15_000);
  const feed = useAlertFeed();
  const stationNames = useStationNames();

  const [status, setStatus] = useState<StatusFilter>('UNRESOLVED');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  // Server-side filters where the API has them; "not resolved" is filtered here.
  const params = new URLSearchParams();
  if (status === 'OPEN' || status === 'ACKED' || status === 'RESOLVED') params.set('status', status);
  if (category) params.set('category', category);
  if (severity) params.set('severity', severity);
  const alerts = useApiQuery<Alert[]>(scoped(`/alerts${params.size ? `?${params}` : ''}`));

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

  useRealtimeEvent('alert', (a) => {
    if (!inScope(a.branchId) || !matches(a, status, category, severity)) return;
    alerts.setData((list) => [a, ...(list ?? []).filter((x) => x.id !== a.id)]);
    setFresh((f) => new Set(f).add(a.id));
  });
  useOnReconnect(alerts.reload);

  async function act(a: Alert, action: 'ack' | 'resolve') {
    setBusy(a.id);
    setError(null);
    try {
      const updated = await api<Alert>('POST', `/alerts/${a.id}/${action}`);
      alerts.setData((list) =>
        (list ?? []).map((x) => (x.id === updated.id ? updated : x)).filter((x) => matches(x, status, category, severity)),
      );
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
            <tr key={a.id} className={a.status === 'RESOLVED' ? 'row-muted' : ''}>
              <td className="nowrap">
                {formatDateTime(a.occurredAt)}
                <div className="muted">{formatAgo(a.occurredAt, now)}</div>
              </td>
              <td>
                <Link to={`/stations/${a.machineId}`}>{stationNames.get(a.machineId) ?? a.machineId.slice(0, 8)}</Link>
              </td>
              {showBranch && <td>{branchName(a.branchId)}</td>}
              <td>{CATEGORY_LABEL[a.category] ?? a.category}</td>
              <td>
                {typeLabel(a.type)}
                {fresh.has(a.id) && a.status === 'OPEN' && <span className="new-tag">NEW</span>}
              </td>
              <td className={isSevere(a.severity) ? 'status-bad' : ''}>{a.severity}</td>
              <td>{a.detail}</td>
              <td className={a.status === 'OPEN' ? 'status-ok' : ''}>{STATUS_LABEL[a.status]}</td>
              <td className="nowrap">
                {busy === a.id ? (
                  <i>working…</i>
                ) : (
                  <>
                    {a.status === 'OPEN' && (
                      <>
                        <button type="button" onClick={() => act(a, 'ack')}>
                          Acknowledge
                        </button>{' '}
                      </>
                    )}
                    {a.status !== 'RESOLVED' && (
                      <button type="button" className="secondary" onClick={() => act(a, 'resolve')}>
                        Resolve
                      </button>
                    )}
                    {a.status === 'RESOLVED' && <span className="muted">—</span>}
                  </>
                )}
              </td>
            </tr>
          ))}
          {!alerts.loading && list.length === 0 && (
            <tr>
              <td colSpan={9} className="muted">
                No alerts match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
