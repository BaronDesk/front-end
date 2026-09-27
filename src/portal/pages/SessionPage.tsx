import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { api } from '../../api/http';
import type { SessionView, StationAvailability } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useOnReconnect, useRealtime, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { formatDuration, formatMoney, secondsSince, useNow } from '../../shared/format';
import { ErrorBox } from '../../shared/ErrorBox';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';

/** Fallback when live updates don't reach the phone (the gamer room isn't on the real backend yet). */
const POLL_MS = 30_000;

function Bill({ session }: { session: SessionView }) {
  const b = session.billing;
  if (!b) return <p>Charged: {formatMoney(session.estimatedCost)}</p>;
  return (
    <table className="grid bill">
      <tbody>
        <tr>
          <td>
            Play time ({b.minutes} min at {formatMoney(b.ratePerHour)}/h)
          </td>
          <td>{formatMoney(b.subtotal)}</td>
        </tr>
        {b.hoursFromPass > 0 && (
          <tr>
            <td>Hours from your pass</td>
            <td>{b.hoursFromPass} h</td>
          </tr>
        )}
        {b.discount > 0 && (
          <tr>
            <td>Member discount ({b.discountPercent} %)</td>
            <td>−{formatMoney(b.discount)}</td>
          </tr>
        )}
        <tr className="bill-total">
          <td>Total</td>
          <td>{formatMoney(b.total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Own live session (brief §6.6): time played, cost so far, time left, low-balance warning. */
export function SessionPage() {
  const { user } = useAuth();
  const { state } = useRealtime();
  const now = useNow(1_000);
  const session = useApiQuery<SessionView | null>('/me/session');
  const stations = useApiQuery<StationAvailability[]>('/stations/availability');
  const action = useAction();
  // The last session that ended while this page was open, to show its bill.
  const [ended, setEnded] = useState<SessionView | null>(null);
  const { reload, setData } = session;

  useEffect(() => {
    const id = setInterval(reload, POLL_MS);
    return () => clearInterval(id);
  }, [reload]);
  useOnReconnect(reload);

  // Numbers are the server's; the browser only moves the clock between updates.
  useRealtimeEvent('session_update', (e) => {
    if (e.userId !== user?.id) return; // only ever our own session
    if (e.status === 'ENDED') {
      const current = session.data;
      if (current?.id === e.sessionId) {
        setEnded({
          ...current,
          status: 'ENDED',
          elapsedSeconds: e.elapsedSeconds,
          estimatedCost: e.estimatedCost,
          balance: e.balance,
          runoutAt: null,
          billing: e.billing,
          endedAt: new Date().toISOString(),
        });
      }
      setData(() => null);
      return;
    }
    setData((s) =>
      s?.id === e.sessionId
        ? { ...s, status: e.status, elapsedSeconds: e.elapsedSeconds, estimatedCost: e.estimatedCost, balance: e.balance, runoutAt: e.runoutAt }
        : s,
    );
    if (session.data?.id !== e.sessionId) reload(); // started at the desk just now
  });

  async function end(s: SessionView) {
    if (!window.confirm('End your session now? The station locks and you are billed.')) return;
    const result = await action.run('end', () => api<SessionView>('POST', `/sessions/${s.id}/end`, { reason: 'USER_ENDED' }));
    if (result) {
      setEnded(result);
      setData(() => null);
    }
  }

  const s = session.data;
  const stationName = (id: string) => stations.data?.find((x) => x.machineId === id)?.name ?? 'your station';
  const secondsLeft = s?.runoutAt ? Math.max(0, (Date.parse(s.runoutAt) - now) / 1000) : null;
  const elapsed = s ? secondsSince(s.startedAt, now) : 0;

  return (
    <>
      <h1>My session</h1>
      <ErrorBox error={session.error} />
      <ActionMessages action={action} />
      {state !== 'connected' && s && <div className="msg">Live updates are off. The numbers refresh every 30 seconds.</div>}

      {session.loading && session.data === undefined && <p className="muted">Loading…</p>}

      {s && (
        <>
          {s.status === 'WARNED' && (
            <div className="msg msg-error" role="alert">
              <b>Low balance.</b> About {formatDuration(secondsLeft ?? 0)} of play left, then the station locks.{' '}
              <Link to="/wallet">Top up now »</Link>
            </div>
          )}
          <table className="kv">
            <tbody>
              <tr>
                <th>Station</th>
                <td>
                  <b>{stationName(s.machineId)}</b>
                </td>
              </tr>
              <tr>
                <th>Playing for</th>
                <td>{formatDuration(elapsed)}</td>
              </tr>
              <tr>
                <th>Cost so far</th>
                <td>
                  <b>{formatMoney(s.estimatedCost)}</b>
                </td>
              </tr>
              <tr>
                <th>Balance left</th>
                <td className={s.balance <= 0 ? 'status-bad' : ''}>{formatMoney(s.balance)}</td>
              </tr>
              <tr>
                <th>Time left</th>
                <td className={s.status === 'WARNED' ? 'status-bad' : ''}>{secondsLeft === null ? '—' : formatDuration(secondsLeft)}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted">The cost is an estimate; the bill at the end is final.</p>
          <p>
            <Link to="/wallet" className="button wide">
              Top up
            </Link>
          </p>
          <p>
            <button type="button" className="secondary wide" disabled={action.busy === 'end'} onClick={() => end(s)}>
              {action.busy === 'end' ? 'Ending…' : 'End my session'}
            </button>
          </p>
        </>
      )}

      {ended && (
        <>
          <h2>Last session: {stationName(ended.machineId)}</h2>
          {ended.balance <= 0 && <div className="msg msg-error">Your balance ran out, so the station was locked.</div>}
          <Bill session={ended} />
        </>
      )}

      {s === null && !ended && (
        <>
          <p>You are not playing right now.</p>
          <p className="muted">Sessions are started at the desk, or when you check in for a booking.</p>
          <p>
            <Link to="/availability">See free stations »</Link>
          </p>
        </>
      )}
    </>
  );
}
