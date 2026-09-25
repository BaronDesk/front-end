import { useRef, useState } from 'react';

import { api } from '../../api/http';
import type { EnrollmentStatus, Station } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatAgo, useNow } from '../../shared/format';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchNames } from '../useLookups';

const FILTERS: { value: EnrollmentStatus; label: string }[] = [
  { value: 'PENDING', label: 'Waiting for approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'REVOKED', label: 'Revoked' },
];

type Action = 'approve' | 'reject' | 'revoke';

/** Dynamic PC registration, the second half of Node Tracking (brief §6.4). */
export function EnrollmentPage() {
  const { user } = useAuth();
  const isHq = user?.branchId === null;
  const now = useNow(10_000);
  const [status, setStatus] = useState<EnrollmentStatus>('PENDING');
  const stations = useApiQuery<Station[]>(`/enrollment?status=${status}`);
  const branchNames = useBranchNames(isHq);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new PC asking to enroll shows up as a station_status event: reload the list.
  useRealtimeEvent('station_status', () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(stations.reload, 300);
  });
  useOnReconnect(stations.reload);

  async function act(s: Station, action: Action) {
    if (action === 'revoke' && !window.confirm(`Revoke ${s.name}? It is disconnected and must enroll again.`)) return;
    setBusy(s.id);
    setError(null);
    setDone(null);
    try {
      await api('POST', `/enrollment/${s.id}/${action}`);
      setDone(`${s.name}: ${action === 'approve' ? 'approved. It now shows under Stations.' : action === 'reject' ? 'rejected.' : 'revoked.'}`);
      stations.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  const list = stations.data ?? [];

  return (
    <>
      <h1>New stations</h1>
      <p>A PC running the BaronDesk agent for the first time asks to join. Approve it to issue its station credential.</p>
      <ErrorBox error={stations.error ?? error} />
      {done && <div className="msg">{done}</div>}

      <div className="toolbar">
        <label htmlFor="enroll-filter">Show</label>
        <select id="enroll-filter" value={status} onChange={(e) => setStatus(e.target.value as EnrollmentStatus)}>
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>{' '}
        <button type="button" className="secondary" onClick={stations.reload}>
          Refresh
        </button>
        {stations.loading && <span className="muted"> loading…</span>}
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            {isHq && <th>Branch</th>}
            <th>MAC address</th>
            <th>IP address</th>
            <th>Agent</th>
            <th>Last seen</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td>
                <b>{s.name}</b>
              </td>
              {isHq && <td>{branchNames.get(s.branchId) ?? '—'}</td>}
              <td>
                <code>{s.mac}</code>
              </td>
              <td>{s.ip}</td>
              <td className={s.online ? 'status-ok' : 'status-bad'}>{s.online ? 'ONLINE' : 'OFFLINE'}</td>
              <td>{formatAgo(s.lastSeenAt, now)}</td>
              <td className="nowrap">
                {busy === s.id ? (
                  <i>working…</i>
                ) : s.enrollmentStatus === 'PENDING' ? (
                  <>
                    <button type="button" onClick={() => act(s, 'approve')}>
                      Approve
                    </button>{' '}
                    <button type="button" className="secondary" onClick={() => act(s, 'reject')}>
                      Reject
                    </button>
                  </>
                ) : s.enrollmentStatus === 'APPROVED' ? (
                  <button type="button" className="secondary" onClick={() => act(s, 'revoke')}>
                    Revoke
                  </button>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
          {!stations.loading && list.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                {status === 'PENDING' ? 'No station is waiting for approval.' : 'Nothing here.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
