import { useState } from 'react';

import { ApiError } from '../../api/http';
import type { AuditLogEntry } from '../../api/types';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime } from '../../shared/format';
import { useApiQuery } from '../../shared/useApiQuery';
import { dayRange, localDateInput } from '../bookings/bookings';
import { useBranchScope } from '../branch/BranchContext';
import { actionText, AUDIT_ACTIONS, detailsText, isSerious, targetText } from './audit';

const LIST_LIMIT = 100;

/**
 * Audit log (HQ): who did which sensitive action, to what, and when: role
 * changes, suspensions, password resets, refunds, shutdowns, revoked stations,
 * branch, plan and price changes. Reads GET /audit-logs (HQ: the branch in the
 * top bar); no live event, so it reloads on demand.
 */
export function AuditPage() {
  const { isHq, branchId, branchName, scoped } = useBranchScope();
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return localDateInput(d);
  });
  const [action, setAction] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const params = new URLSearchParams({ from: dayRange(date, 1).from, limit: String(LIST_LIMIT) });
  if (action) params.set('action', action);
  if (search) params.set('q', search);
  const logs = useApiQuery<AuditLogEntry[]>(scoped(`/audit-logs?${params}`));

  const notBuilt = logs.error instanceof ApiError && logs.error.status === 404;
  const rows = logs.data ?? [];
  const showBranch = isHq && !branchId;
  const columns = showBranch ? 6 : 5;

  return (
    <>
      <h1>Audit log</h1>
      <p className="muted">
        Who did what: role changes, suspended accounts, password resets, wallet refunds, shut down or revoked stations, and changes to
        branches, plans and prices.
      </p>

      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <label htmlFor="au-date">Since</label>{' '}
        <input id="au-date" type="date" required value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <span className="sep-v" />
        <label htmlFor="au-action">Action</label>{' '}
        <select id="au-action" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {actionText(a)}
            </option>
          ))}
        </select>
        <span className="sep-v" />
        <label htmlFor="au-q">Who or what</label>{' '}
        <input id="au-q" type="search" placeholder="username, station…" value={query} onChange={(e) => setQuery(e.target.value)} />{' '}
        <button type="submit" className="secondary">
          Search
        </button>
        <span className="sep-v" />
        <button type="button" className="secondary" onClick={logs.reload}>
          Reload
        </button>
        {logs.loading && <span className="muted"> loading…</span>}
      </form>

      {notBuilt ? (
        <p className="msg msg-error">
          The backend doesn&apos;t record an audit log yet (<code>GET /audit-logs</code> answers 404). This page fills in once it does.
        </p>
      ) : (
        <ErrorBox error={logs.error} />
      )}

      <table className="grid">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            {showBranch && <th>Branch</th>}
            <th>Action</th>
            <th>On</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="nowrap">{formatDateTime(e.timestamp)}</td>
              <td>
                <b>{e.username ?? 'deleted user'}</b>
              </td>
              {showBranch && <td>{e.branchId ? branchName(e.branchId) : <span className="muted">all</span>}</td>}
              <td className={isSerious(e.action) ? 'status-bad' : ''}>{actionText(e.action)}</td>
              <td>{targetText(e)}</td>
              <td className="muted">{detailsText(e.metadata)}</td>
            </tr>
          ))}
          {!logs.loading && !logs.error && rows.length === 0 && (
            <tr>
              <td colSpan={columns} className="muted">
                Nothing recorded since that day.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.length === LIST_LIMIT && <p className="muted">Showing the newest {LIST_LIMIT}: pick a later day or an action to see fewer.</p>}
    </>
  );
}
