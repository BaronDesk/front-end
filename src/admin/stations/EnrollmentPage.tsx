import { useEffect, useState } from 'react';

import { api } from '../../api/http';
import type { EnrollmentToken, Machine, MachineEnrollmentStatus } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatAgo, formatDateTime, useNow } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { stationLabel } from './station';

const MACHINES_PATH = '/machines';

type Filter = MachineEnrollmentStatus | 'ALL';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Waiting for approval' },
  { value: 'ENROLLED', label: 'Enrolled' },
  { value: 'DEACTIVATED', label: 'Rejected or revoked' },
  { value: 'ALL', label: 'All' },
];

const STATUS_LABEL: Record<MachineEnrollmentStatus, string> = {
  PENDING: 'Waiting',
  ENROLLED: 'Enrolled',
  INACTIVE: 'Inactive',
  DEACTIVATED: 'Rejected / revoked',
};

/** How long a new enrollment token stays usable (the server allows 1 min to 24 h). */
const TTL_CHOICES = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 120, label: '2 hours' },
  { minutes: 480, label: '8 hours' },
  { minutes: 1440, label: '24 hours' },
];

/** A PENDING request raises no live event (the PC can't connect before approval), so the list is polled. */
const POLL_MS = 15_000;

interface IssuedToken extends EnrollmentToken {
  /** Who it is for: a new PC in a branch, or a re-enrollment of one machine. */
  forWhat: string;
}

/**
 * Dynamic PC registration, the second half of Node Tracking (brief §6.4).
 * A manager issues a one-time enrollment token; the PC's agent uses it to ask
 * to join (it shows here as waiting); approving it lets the PC connect.
 */
export function EnrollmentPage() {
  const { isHq, branchId, branchName, scoped } = useBranchScope();
  const showBranch = isHq && branchId === null;
  const now = useNow(10_000);
  const action = useAction();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [ttl, setTtl] = useState(TTL_CHOICES[0].minutes);
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const machines = useApiQuery<Machine[]>(scoped(`${MACHINES_PATH}${filter === 'ALL' ? '' : `?status=${filter}`}`));

  const { reload } = machines;
  useEffect(() => {
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);
  useOnReconnect(reload);
  // An approved PC connecting (or a revoked one dropping off) changes its row.
  useRealtimeEvent('station_status', () => reload());

  async function decide(m: Machine, verb: 'approve' | 'reject' | 'revoke') {
    const name = stationLabel(m);
    if (verb === 'revoke' && !window.confirm(`Revoke ${name}? It can no longer connect and must enroll again.`)) return;
    const done = await action.run(
      m.id,
      () => api<Machine>('POST', `${MACHINES_PATH}/${m.id}/${verb}`),
      verb === 'approve'
        ? `${name} approved. It connects on its next try and then shows under Stations.`
        : verb === 'reject'
          ? `${name} rejected.`
          : `${name} revoked.`,
    );
    if (done) reload();
  }

  async function issueToken() {
    if (!branchId) return;
    const token = await action.run('token', () =>
      api<EnrollmentToken>('POST', `${MACHINES_PATH}/enrollment-tokens`, { branchId, ttlMinutes: ttl }),
    );
    if (token) setIssued({ ...token, forWhat: `a new PC in ${branchName(branchId)}` });
  }

  async function rotateToken(m: Machine) {
    const token = await action.run(`rotate-${m.id}`, () => api<EnrollmentToken>('POST', `${MACHINES_PATH}/${m.id}/rotate-token`));
    if (token) setIssued({ ...token, forWhat: `re-enrolling ${stationLabel(m)}` });
  }

  const list = machines.data ?? [];

  return (
    <>
      <h1>New stations</h1>
      <p>
        A PC joins in two steps: give its agent a one-time <b>enrollment token</b>, then approve its request below. Only approved PCs can
        connect.
      </p>
      <ActionMessages action={action} />
      <ErrorBox error={machines.error} />

      <h2>Add a PC</h2>
      {branchId ? (
        <div className="toolbar">
          Token for a PC in <b>{branchName(branchId)}</b>, usable for{' '}
          <select aria-label="Token validity" value={ttl} onChange={(e) => setTtl(Number(e.target.value))}>
            {TTL_CHOICES.map((c) => (
              <option key={c.minutes} value={c.minutes}>
                {c.label}
              </option>
            ))}
          </select>{' '}
          <button type="button" disabled={action.busy === 'token'} onClick={issueToken}>
            Generate enrollment token
          </button>
        </div>
      ) : (
        <p className="muted">Pick a branch in the top bar: a token enrolls a PC into one branch.</p>
      )}

      {issued && (
        <div className="msg">
          <b>Enrollment token</b> for {issued.forWhat} (shown once, usable until {formatDateTime(issued.expiresAt)}):
          <pre className="token">{issued.token}</pre>
          On the PC, in an administrator PowerShell in the agent's folder, run{' '}
          <code>.\BaronDeskAgent.ServiceCore.exe --set-enrollment-token</code>, paste the token when asked, then start the agent. Its request
          appears below as <i>Waiting</i> within {POLL_MS / 1000} seconds.{' '}
          <button type="button" className="secondary" onClick={() => setIssued(null)}>
            Hide
          </button>
        </div>
      )}

      <h2>Requests and enrolled PCs</h2>
      <div className="toolbar">
        <label htmlFor="enroll-filter">Show</label>
        <select id="enroll-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>{' '}
        <button type="button" className="secondary" onClick={reload}>
          Refresh
        </button>
        {machines.loading && <span className="muted"> loading…</span>}
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Serial number</th>
            {showBranch && <th>Branch</th>}
            <th>Asked to join</th>
            <th>Agent</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id} className={m.enrollmentStatus === 'DEACTIVATED' ? 'row-muted' : ''}>
              <td>
                <b>{stationLabel(m)}</b>
              </td>
              <td>
                <code>{m.serialNumber}</code>
              </td>
              {showBranch && <td>{branchName(m.branchId)}</td>}
              <td>{formatDateTime(m.createdAt)}</td>
              <td className={m.status === 'ONLINE' ? 'status-ok' : 'muted'}>
                {m.status}
                {m.lastSeen && <div className="muted">seen {formatAgo(m.lastSeen, now)}</div>}
              </td>
              <td>{STATUS_LABEL[m.enrollmentStatus]}</td>
              <td className="nowrap">
                {action.busy === m.id ? (
                  <i>working…</i>
                ) : m.enrollmentStatus === 'PENDING' ? (
                  <>
                    <button type="button" onClick={() => decide(m, 'approve')}>
                      Approve
                    </button>{' '}
                    <button type="button" className="secondary" onClick={() => decide(m, 'reject')}>
                      Reject
                    </button>
                  </>
                ) : m.enrollmentStatus === 'ENROLLED' ? (
                  <>
                    <button type="button" className="secondary" disabled={action.busy === `rotate-${m.id}`} onClick={() => rotateToken(m)}>
                      New token
                    </button>{' '}
                    <button type="button" className="secondary" onClick={() => decide(m, 'revoke')}>
                      Revoke
                    </button>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
          {!machines.loading && list.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                {filter === 'PENDING' ? 'No PC is waiting for approval.' : 'Nothing here.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
