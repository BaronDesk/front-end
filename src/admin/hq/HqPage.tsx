import { useRef } from 'react';
import { useNavigate } from 'react-router';

import type { BranchSummary } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';

/** Multi-Agency (brief §6.12): every branch at a glance, then work inside one. */
export function HqPage() {
  const navigate = useNavigate();
  const { branchId, setBranchId } = useBranchScope();
  // Counts come from the server, whatever branch the top bar shows.
  const summary = useApiQuery<BranchSummary[]>('/branches/summary');
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Events arrive for every branch (HQ is in branch:all); one reload per burst.
  function reloadSoon() {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(summary.reload, 500);
  }
  useRealtimeEvent('station_status', reloadSoon);
  useRealtimeEvent('session_update', (e) => e.status === 'ENDED' && reloadSoon());
  useRealtimeEvent('alert', reloadSoon);
  useOnReconnect(summary.reload);

  const rows = [...(summary.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const sum = (key: keyof Omit<BranchSummary, 'branchId' | 'name'>) => rows.reduce((n, r) => n + r[key], 0);

  function open(id: string | null, page: string) {
    setBranchId(id);
    navigate(page);
  }

  return (
    <>
      <h1>HQ overview</h1>
      <ErrorBox error={summary.error} />
      <p>
        Pick a branch to work in it: lists and actions (lock, sessions, bookings, staff) then cover only that branch. The same choice is in
        the top bar.
        {summary.loading && <span className="muted"> &middot; loading…</span>}
      </p>

      <table className="grid">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Stations</th>
            <th>Online</th>
            <th>Offline</th>
            <th>In session</th>
            <th>Open alerts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const offline = r.stationsTotal - r.stationsOnline;
            const current = r.branchId === branchId;
            return (
              <tr key={r.branchId} className={current ? 'row-current' : ''}>
                <td>
                  <b>{r.name}</b>
                  {current && <span className="muted"> (selected)</span>}
                </td>
                <td>{r.stationsTotal}</td>
                <td className="status-ok">{r.stationsOnline}</td>
                <td className={offline ? 'status-bad' : 'muted'}>{offline}</td>
                <td>{r.stationsInSession}</td>
                <td className={r.openAlerts ? 'status-bad' : 'muted'}>{r.openAlerts || '—'}</td>
                <td className="nowrap">
                  <button type="button" onClick={() => open(r.branchId, '/stations')}>
                    Stations
                  </button>{' '}
                  <button type="button" onClick={() => open(r.branchId, '/alerts')}>
                    Alerts
                  </button>{' '}
                  <button type="button" onClick={() => open(r.branchId, '/sessions')}>
                    Sessions
                  </button>
                </td>
              </tr>
            );
          })}
          {!summary.loading && rows.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                No branches.
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 1 && (
          <tfoot>
            <tr className={branchId === null ? 'row-current' : ''}>
              <td>
                <b>All branches</b>
                {branchId === null && <span className="muted"> (selected)</span>}
              </td>
              <td>{sum('stationsTotal')}</td>
              <td className="status-ok">{sum('stationsOnline')}</td>
              <td className={sum('stationsTotal') - sum('stationsOnline') ? 'status-bad' : 'muted'}>{sum('stationsTotal') - sum('stationsOnline')}</td>
              <td>{sum('stationsInSession')}</td>
              <td className={sum('openAlerts') ? 'status-bad' : 'muted'}>{sum('openAlerts') || '—'}</td>
              <td className="nowrap">
                <button type="button" onClick={() => open(null, '/stations')}>
                  All stations
                </button>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </>
  );
}
