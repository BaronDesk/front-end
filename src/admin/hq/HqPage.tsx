import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { api } from '../../api/http';
import type { Alert, Branch, Station } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { ALERTS_PATH } from '../alerts/labels';
import { useBranchScope } from '../branch/BranchContext';
import { STATIONS_PATH } from '../stations/station';

interface BranchRow {
  branchId: string;
  name: string;
  total: number;
  online: number;
  inSession: number;
  openAlerts: number;
}

/**
 * Multi-Agency (brief §6.12): every branch at a glance, then work inside one.
 * The backend has no summary endpoint, so the counts are built here from the
 * machines (branch, enrollment), the stations (live status, session) and the
 * open alerts, always across every branch whatever the top bar shows.
 * HQ also creates and edits branches here (name, location).
 */
export function HqPage() {
  const navigate = useNavigate();
  const { branches, machines, branchId, setBranchId, reloadMachines, reloadBranches } = useBranchScope();
  const stations = useApiQuery<Station[]>(STATIONS_PATH);
  const alerts = useApiQuery<Alert[]>(`${ALERTS_PATH}?status=open&limit=500`);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [edit, setEdit] = useState<Branch | null>(null);

  // Events arrive for every branch (HQ is in branch:all); one reload per burst.
  function reloadSoon() {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      stations.reload();
      alerts.reload();
    }, 500);
  }
  useRealtimeEvent('station_status', reloadSoon);
  useRealtimeEvent('alert', reloadSoon);
  useRealtimeEvent('alert_resolved', reloadSoon);
  useOnReconnect(() => {
    reloadMachines();
    reloadSoon();
  });

  const rows = useMemo<BranchRow[]>(() => {
    const stationById = new Map((stations.data ?? []).map((s) => [s.id, s]));
    return branches.map((b) => {
      const enrolled = machines.filter((m) => m.branchId === b.id && m.enrollmentStatus === 'ENROLLED');
      const live = enrolled.map((m) => stationById.get(m.id));
      return {
        branchId: b.id,
        name: b.name,
        total: enrolled.length,
        online: live.filter((s) => s?.status === 'ONLINE').length,
        inSession: live.filter((s) => s?.sessionId).length,
        openAlerts: (alerts.data ?? []).filter((a) => a.branchId === b.id).length,
      };
    });
  }, [branches, machines, stations.data, alerts.data]);

  const editing = (id: string) => branches.find((b) => b.id === id);

  const sum = (key: keyof Omit<BranchRow, 'branchId' | 'name'>) => rows.reduce((n, r) => n + r[key], 0);
  const loading = stations.loading || alerts.loading;

  function open(id: string | null, page: string) {
    setBranchId(id);
    navigate(page);
  }

  return (
    <>
      <h1>HQ overview</h1>
      <ErrorBox error={stations.error ?? alerts.error} />
      <p>
        Pick a branch to work in it: lists and actions (lock, sessions, prices, games) then cover only that branch. The same choice is in the
        top bar.
        {loading && <span className="muted"> &middot; loading…</span>}
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
            const offline = r.total - r.online;
            const current = r.branchId === branchId;
            return (
              <tr key={r.branchId} className={current ? 'row-current' : ''}>
                <td>
                  <b>{r.name}</b>
                  {current && <span className="muted"> (selected)</span>}
                </td>
                <td>{r.total}</td>
                <td className="status-ok">{r.online}</td>
                <td className={offline ? 'status-bad' : 'muted'}>{offline}</td>
                <td>{r.inSession}</td>
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
                  </button>{' '}
                  <button type="button" className="secondary" onClick={() => setEdit(editing(r.branchId) ?? null)}>
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                No branch yet: create one below.
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
              <td>{sum('total')}</td>
              <td className="status-ok">{sum('online')}</td>
              <td className={sum('total') - sum('online') ? 'status-bad' : 'muted'}>{sum('total') - sum('online')}</td>
              <td>{sum('inSession')}</td>
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

      <BranchForm key={edit?.id ?? 'new'} branch={edit} onDone={() => setEdit(null)} onSaved={reloadBranches} />
    </>
  );
}

/**
 * Create a branch, or rename / move the one being edited (POST and PATCH
 * /branches, HQ only). A new branch has no PC yet: enroll its stations on
 * New stations, and set its play prices on Plans & prices.
 */
function BranchForm({ branch, onDone, onSaved }: { branch: Branch | null; onDone(): void; onSaved(): void }) {
  const action = useAction();
  const [name, setName] = useState(branch?.name ?? '');
  const [location, setLocation] = useState(branch?.location ?? '');

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = { name: name.trim(), location: location.trim() };
    const saved = branch
      ? await action.run('save-branch', () => api<Branch>('PATCH', `/branches/${branch.id}`, body), (b) => `Branch ${b.name} saved.`)
      : await action.run('save-branch', () => api<Branch>('POST', '/branches', body), (b) => `Branch ${b.name} created.`);
    if (!saved) return;
    onSaved();
    if (branch) {
      onDone();
    } else {
      setName('');
      setLocation('');
    }
  }

  return (
    <form onSubmit={save} style={{ marginTop: 8 }}>
      <fieldset>
        <legend>{branch ? `Edit ${branch.name}` : 'New branch'}</legend>
        <ActionMessages action={action} />
        <div className="form-row">
          <label htmlFor="b-name">Name</label>
          <input id="b-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="b-location">Location</label>
          <input id="b-location" required maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="form-row">
          <label />
          <button type="submit" disabled={action.busy === 'save-branch'}>
            {branch ? 'Save changes' : 'Create branch'}
          </button>{' '}
          {branch && (
            <button type="button" className="secondary" onClick={onDone}>
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
