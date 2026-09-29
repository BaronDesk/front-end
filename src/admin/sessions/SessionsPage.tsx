import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { api } from '../../api/http';
import type { SessionView, Station } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatClock, formatDuration, formatMoney, secondsSince, useNow } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { GamerSelect, StationSelect } from '../pickers';
import { isOnline } from '../stations/station';
import { useGamerNames, useStationNames } from '../useLookups';
import { endReasonLabel } from './labels';

interface EndedNotice {
  sessionId: string;
  text: string;
}

/** Session & financial control (brief §6.6): live time and cost, walk-in start, end → bill. */
export function SessionsPage() {
  const navigate = useNavigate();
  const now = useNow(1_000);
  const { scoped, inScope } = useBranchScope();
  const active = useApiQuery<SessionView[]>(scoped('/sessions?status=ACTIVE'));
  const ended = useApiQuery<SessionView[]>(scoped('/sessions?status=ENDED'));
  const gamerNames = useGamerNames();
  const stationNames = useStationNames();
  const action = useAction();
  const [form, setForm] = useState({ userId: '', machineId: '' });
  const [endedNotices, setEndedNotices] = useState<EndedNotice[]>([]);
  // Bumped to refresh the free-station list after a start/end.
  const [stationsVersion, setStationsVersion] = useState(0);

  const station = (id: string) => stationNames.get(id) ?? id.slice(0, 8);
  const gamer = (id: string) => gamerNames.get(id) ?? 'gamer';

  // Live numbers come from the server; the browser only moves the clock between updates.
  useRealtimeEvent('session_update', (e) => {
    if (!inScope(e.branchId)) return;
    if (e.status === 'ENDED') {
      active.setData((list) => list?.filter((s) => s.id !== e.sessionId));
      ended.reload();
      setStationsVersion((v) => v + 1);
      setEndedNotices((n) =>
        [
          {
            sessionId: e.sessionId,
            text: `${formatClock(new Date().toISOString())} Session on ${station(e.machineId)} (${gamer(e.userId)}) ended${
              e.balance <= 0 ? ': balance empty, station locked' : ''
            }. Charged ${formatMoney(e.billing?.total ?? e.estimatedCost)}.`,
          },
          ...n,
        ].slice(0, 5),
      );
      return;
    }
    if (!active.data?.some((s) => s.id === e.sessionId)) {
      active.reload();
      return;
    }
    active.setData((list) =>
      list?.map((s) =>
        s.id === e.sessionId
          ? { ...s, status: e.status, elapsedSeconds: e.elapsedSeconds, estimatedCost: e.estimatedCost, balance: e.balance, runoutAt: e.runoutAt }
          : s,
      ),
    );
  });
  useOnReconnect(() => {
    active.reload();
    ended.reload();
  });

  async function start(e: FormEvent) {
    e.preventDefault();
    const s = await action.run(
      'start',
      () => api<SessionView>('POST', '/sessions', form),
      (x) => `Session started on ${station(x.machineId)} for ${gamer(x.userId)}. The station unlocks.`,
    );
    if (s) {
      setForm({ userId: '', machineId: '' });
      setStationsVersion((v) => v + 1);
      active.reload();
    }
  }

  async function end(s: SessionView) {
    if (!window.confirm(`End the session of ${gamer(s.userId)} on ${station(s.machineId)} and bill it now?`)) return;
    const done = await action.run(s.id, () => api<SessionView>('POST', `/sessions/${s.id}/end`, { reason: 'STAFF_ENDED' }));
    if (done) navigate(`/sessions/${s.id}`);
  }

  const running = [...(active.data ?? [])].sort((a, b) => station(a.machineId).localeCompare(station(b.machineId)));
  const recent = [...(ended.data ?? [])].sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? '')).slice(0, 15);

  return (
    <>
      <h1>Sessions</h1>
      <ActionMessages action={action} />
      <ErrorBox error={active.error} />
      {endedNotices.length > 0 && (
        <div className="msg">
          <b>Just ended</b>
          <ul className="notices">
            {endedNotices.map((n) => (
              <li key={n.sessionId}>
                {n.text} <Link to={`/sessions/${n.sessionId}`}>Bill »</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2>Running now ({running.length})</h2>
      <table className="grid">
        <thead>
          <tr>
            <th>Station</th>
            <th>Gamer</th>
            <th>Started</th>
            <th>Time played</th>
            <th>Cost so far</th>
            <th>Balance left</th>
            <th>Runs out at</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {running.map((s) => (
            <tr key={s.id}>
              <td>
                <Link to={`/stations/${s.machineId}`}>
                  <b>{station(s.machineId)}</b>
                </Link>
              </td>
              <td>{gamer(s.userId)}</td>
              <td>{formatClock(s.startedAt)}</td>
              <td>{formatDuration(secondsSince(s.startedAt, now))}</td>
              <td>{formatMoney(s.estimatedCost)}</td>
              <td className={s.status === 'WARNED' ? 'status-bad' : ''}>{formatMoney(s.balance)}</td>
              <td>{s.runoutAt ? formatClock(s.runoutAt) : '—'}</td>
              <td className={s.status === 'WARNED' ? 'status-bad' : 'status-ok'}>{s.status === 'WARNED' ? 'LOW BALANCE' : 'Playing'}</td>
              <td className="nowrap">
                <button type="button" disabled={action.busy === s.id} onClick={() => end(s)}>
                  End &amp; bill
                </button>{' '}
                <Link to={`/sessions/${s.id}`}>Details »</Link>
              </td>
            </tr>
          ))}
          {!active.loading && running.length === 0 && (
            <tr>
              <td colSpan={9} className="muted">
                No session running.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="muted">Cost and balance are the server's estimate, updated every few seconds.</p>

      <div className="columns">
        <form onSubmit={start}>
          <h2>Start a walk-in session</h2>
          <fieldset>
            <legend>Walk-in</legend>
            <div className="form-row">
              <label htmlFor="w-gamer">Gamer</label>
              <GamerSelect id="w-gamer" required value={form.userId} onChange={(v) => setForm({ ...form, userId: v })} />
            </div>
            <div className="form-row">
              <label htmlFor="w-station">Free station</label>
              <StationSelect
                key={stationsVersion}
                id="w-station"
                required
                value={form.machineId}
                onChange={(v) => setForm({ ...form, machineId: v })}
                filter={(s: Station) => isOnline(s) && !s.sessionId}
              />
            </div>
            <div className="form-row">
              <label />
              <button type="submit" disabled={action.busy === 'start'}>
                {action.busy === 'start' ? 'Starting…' : 'Start session'}
              </button>
            </div>
          </fieldset>
          <p className="muted">Booked gamers: use Check in on the Reservations page.</p>
        </form>

        <div>
          <h2>Recently ended</h2>
          <table className="grid">
            <thead>
              <tr>
                <th>Station</th>
                <th>Gamer</th>
                <th>Ended</th>
                <th>Charged</th>
                <th>Why</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id}>
                  <td>{station(s.machineId)}</td>
                  <td>{gamer(s.userId)}</td>
                  <td>{formatClock(s.endedAt)}</td>
                  <td>{formatMoney(s.billing?.total)}</td>
                  <td>{endReasonLabel(s.endReason)}</td>
                  <td>
                    <Link to={`/sessions/${s.id}`}>Bill »</Link>
                  </td>
                </tr>
              ))}
              {!ended.loading && recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Nothing yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
