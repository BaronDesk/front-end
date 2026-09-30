import { useEffect } from 'react';
import { Link, useParams } from 'react-router';

import { api } from '../../api/http';
import type { Command, Session } from '../../api/types';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime, formatDuration, formatMillimes } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { isOpenSession, SESSION_STATUS_TEXT } from './labels';

/** The backend pushes no session event: an open session is re-read this often. */
const POLL_MS = 5_000;

/**
 * One session and its bill (GET /sessions/:id). Ending it sends END_SESSION
 * to the station; the bill is settled once the station reports the session
 * gone, so the page keeps reading until `settledAt` is set.
 */
export function SessionBillPage() {
  const { id = '' } = useParams();
  const session = useApiQuery<Session>(`/sessions/${id}`);
  const action = useAction();
  const s = session.data;
  const open = s ? isOpenSession(s.status) || !s.settledAt : true;

  const { reload } = session;
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [open, reload]);

  async function end() {
    if (!window.confirm('End this session and bill it now? The station locks.')) return;
    const cmd = await action.run(
      'end',
      () => api<Command>('POST', `/sessions/${id}/end`, { reason: 'staff_end' }),
      'End sent to the station. The bill appears here once the station confirms.',
    );
    if (cmd) reload();
  }

  if (session.error && !s) {
    return (
      <>
        <h1>Session</h1>
        <ErrorBox error={session.error} />
        <Link to="/sessions">« Back to sessions</Link>
      </>
    );
  }
  if (!s) return <p className="muted">Loading…</p>;

  const bill = s.billingBreakdown;

  return (
    <>
      <p>
        <Link to="/sessions">« Back to sessions</Link>
      </p>
      <h1>Session {s.id.slice(0, 8)}</h1>
      <ActionMessages action={action} />

      <table className="kv">
        <tbody>
          <tr>
            <th>Status</th>
            <td className={isOpenSession(s.status) ? 'status-ok' : ''}>{SESSION_STATUS_TEXT[s.status]}</td>
          </tr>
          <tr>
            <th>Booking code</th>
            <td>
              <code>{s.reservationId}</code>
            </td>
          </tr>
          <tr>
            <th>Started</th>
            <td>{formatDateTime(s.startTime)}</td>
          </tr>
          <tr>
            <th>Ended</th>
            <td>{formatDateTime(s.endTime)}</td>
          </tr>
          {s.lockedAt && (
            <tr>
              <th>Locked at</th>
              <td>{formatDateTime(s.lockedAt)}</td>
            </tr>
          )}
          <tr>
            <th>Rate</th>
            <td>
              {s.rateCentsPerMinute != null ? `${formatMillimes(s.rateCentsPerMinute)} / minute` : '—'}
              {s.appliedMembershipId && <span className="muted"> (member discount included)</span>}
            </td>
          </tr>
          <tr>
            <th>Time played</th>
            <td>{formatDuration(s.meteredSeconds)}</td>
          </tr>
        </tbody>
      </table>

      {isOpenSession(s.status) && (
        <p>
          <button type="button" disabled={action.busy === 'end'} onClick={end}>
            End &amp; bill
          </button>
        </p>
      )}

      <h2>Bill</h2>
      {bill ? (
        <table className="kv">
          <tbody>
            <tr>
              <th>Time billed</th>
              <td>{formatDuration(bill.meteredSeconds)}</td>
            </tr>
            <tr>
              <th>Rate</th>
              <td>{formatMillimes(bill.rateCentsPerMinute)} / minute</td>
            </tr>
            <tr>
              <th>Total charged</th>
              <td>
                <b>{formatMillimes(bill.totalCents)}</b>
              </td>
            </tr>
            <tr>
              <th>Settled</th>
              <td>{formatDateTime(s.settledAt)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="muted">
          {isOpenSession(s.status) ? 'The session is still running.' : 'Waiting for the station to confirm the end…'} Amounts come from the
          server only.
        </p>
      )}
    </>
  );
}
