import { Link, useParams } from 'react-router';

import { api } from '../../api/http';
import type { SessionView } from '../../api/types';
import { useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatClock, formatDateTime, formatDuration, formatMoney, secondsSince, useNow } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { useGamerNames, useStationNames } from '../useLookups';
import { endReasonLabel } from './labels';

/** One session: live numbers while it runs, the billing breakdown once it ended. */
export function SessionBillPage() {
  const { id = '' } = useParams();
  const now = useNow(1_000);
  const session = useApiQuery<SessionView>(`/sessions/${id}`);
  const gamerNames = useGamerNames();
  const stationNames = useStationNames();
  const action = useAction();

  useRealtimeEvent('session_update', (e) => {
    if (e.sessionId === id) session.reload();
  });

  if (session.error && !session.data) return <ErrorBox error={session.error} />;
  const s = session.data;
  if (!s) return <p className="muted">Loading…</p>;
  const b = s.billing;
  const ended = s.status === 'ENDED';

  async function end() {
    if (!window.confirm('End this session and bill it now?')) return;
    const done = await action.run('end', () => api<SessionView>('POST', `/sessions/${id}/end`, { reason: 'STAFF_ENDED' }));
    if (done) session.setData(() => done);
  }

  return (
    <>
      <p>
        <Link to="/sessions">« Back to sessions</Link>
      </p>
      <h1>
        Session on {stationNames.get(s.machineId) ?? '…'} &middot; {gamerNames.get(s.userId) ?? 'gamer'}
      </h1>
      <ActionMessages action={action} />

      <table className="kv">
        <tbody>
          <tr>
            <th>Status</th>
            <td className={s.status === 'WARNED' ? 'status-bad' : 'status-ok'}>
              {ended ? 'Ended' : s.status === 'WARNED' ? 'Running, LOW BALANCE' : 'Running'}
            </td>
          </tr>
          <tr>
            <th>Started</th>
            <td>{formatDateTime(s.startedAt)}</td>
          </tr>
          {ended ? (
            <>
              <tr>
                <th>Ended</th>
                <td>{formatDateTime(s.endedAt)}</td>
              </tr>
              <tr>
                <th>Why</th>
                <td>{endReasonLabel(s.endReason)}</td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <th>Time played</th>
                <td>{formatDuration(secondsSince(s.startedAt, now))}</td>
              </tr>
              <tr>
                <th>Cost so far</th>
                <td>{formatMoney(s.estimatedCost)}</td>
              </tr>
              <tr>
                <th>Balance left</th>
                <td>
                  {formatMoney(s.balance)} {s.runoutAt && <span className="muted">(runs out at {formatClock(s.runoutAt)})</span>}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {!ended && (
        <button type="button" disabled={action.busy === 'end'} onClick={end}>
          End &amp; bill now
        </button>
      )}

      {ended && b && (
        <>
          <h2>Bill</h2>
          <table className="grid bill">
            <tbody>
              <tr>
                <td>Time played</td>
                <td>{b.minutes} min</td>
              </tr>
              <tr>
                <td>Rate</td>
                <td>{formatMoney(b.ratePerHour)} / hour</td>
              </tr>
              {b.hoursFromPass > 0 && (
                <tr>
                  <td>Covered by hour pass</td>
                  <td>{b.hoursFromPass} h</td>
                </tr>
              )}
              <tr>
                <td>Subtotal</td>
                <td>{formatMoney(b.subtotal)}</td>
              </tr>
              <tr>
                <td>Membership discount ({b.discountPercent} %)</td>
                <td>−{formatMoney(b.discount)}</td>
              </tr>
              <tr className="bill-total">
                <td>Charged to wallet</td>
                <td>{formatMoney(b.total)}</td>
              </tr>
            </tbody>
          </table>
          {b.total + 0.0005 < b.subtotal - b.discount && (
            <p className="status-bad">The wallet did not cover the full amount; the gamer was charged what was left.</p>
          )}
          <p>
            <Link to={`/wallet?user=${s.userId}`}>Gamer's wallet »</Link>
          </p>
        </>
      )}
    </>
  );
}
