import { useEffect, useState } from 'react';

import { api } from '../../api/http';
import type { ReservationStatus, StaffReservation } from '../../api/types';
import { RESERVATION_TEXT, isCancellable, stationOf } from '../../shared/lib/bookings';
import { useOnReconnect } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { formatDateTime } from '../../shared/lib/format';
import { ActionMessages } from '../../shared/components/ActionMessages';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { useBranchScope } from '../branches/BranchContext';
import { dayRange, localDateInput } from '../../shared/lib/dates';
import { EmptyRow } from '../../shared/components/EmptyRow';

const RESERVATIONS_PATH = '/api/v1/reservations';

/** Bookings raise no live event (gamers book in their app), so the list is polled. */
const POLL_MS = 30_000;
const STATUSES = Object.keys(RESERVATION_TEXT) as ReservationStatus[];
const SPANS = [
  { days: 1, label: 'That day' },
  { days: 7, label: '7 days from then' },
];

/**
 * Who booked which station when (GET /api/v1/reservations, the branch picked
 * in the top bar for HQ), and cancelling a booking nobody plays on yet
 * (DELETE …/:id: its PIN stops working). A running one is ended from Sessions.
 */
export function BookingsPage() {
  const { isHq, branchId, branchName, scoped } = useBranchScope();
  const action = useAction();
  const [date, setDate] = useState(localDateInput);
  const [days, setDays] = useState(1);
  const [status, setStatus] = useState('');

  const { from, to } = dayRange(date, days);
  const params = new URLSearchParams({ from, to });
  if (status) params.set('status', status);
  const list = useApiQuery<StaffReservation[]>(scoped(`${RESERVATIONS_PATH}?${params}`));
  const rows = list.data ?? [];

  const { reload } = list;
  useEffect(() => {
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);
  useOnReconnect(reload);

  async function cancel(r: StaffReservation) {
    const when = formatDateTime(r.startTime);
    if (!window.confirm(`Cancel ${r.gamerUsername}'s booking on ${stationOf(r)} at ${when}? Its PIN stops working.`)) return;
    const done = await action.run(r.id, () => api('DELETE', `${RESERVATIONS_PATH}/${r.id}`), `Booking of ${r.gamerUsername} at ${when} cancelled.`);
    if (done) reload();
  }

  const showBranch = isHq && !branchId;

  return (
    <>
      <h1>Bookings</h1>
      <ActionMessages action={action} />

      <div className="toolbar">
        <label htmlFor="bk-date">From</label>{' '}
        <input id="bk-date" type="date" required value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />{' '}
        <select aria-label="How many days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {SPANS.map((s) => (
            <option key={s.days} value={s.days}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="sep-v" />
        <label htmlFor="bk-status">Status</label>{' '}
        <select id="bk-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {RESERVATION_TEXT[s]}
            </option>
          ))}
        </select>
        <span className="sep-v" />
        <button type="button" className="secondary" onClick={() => setDate(localDateInput())}>
          Today
        </button>{' '}
        <button type="button" className="secondary" onClick={reload}>
          Reload
        </button>
        {list.loading && <span className="muted"> loading…</span>}
      </div>
      <ErrorBox error={list.error} />

      <table className="grid">
        <thead>
          <tr>
            <th>Start</th>
            <th>End</th>
            <th>Station</th>
            {showBranch && <th>Branch</th>}
            <th>Gamer</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDateTime(r.startTime)}</td>
              <td>{formatDateTime(r.endTime)}</td>
              <td>{stationOf(r)}</td>
              {showBranch && <td>{branchName(r.machine.branchId)}</td>}
              <td>
                <b>{r.gamerUsername}</b>
              </td>
              <td className={r.status === 'NO_SHOW' || r.status === 'CANCELLED' ? 'muted' : r.status === 'ACTIVE' ? 'status-ok' : ''}>
                {RESERVATION_TEXT[r.status]}
              </td>
              <td>
                {isCancellable(r) && (
                  <button type="button" className="secondary" disabled={action.busy === r.id} onClick={() => cancel(r)}>
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!list.loading && rows.length === 0 && (
            <EmptyRow colSpan={showBranch ? 7 : 6}>No booking in this time.</EmptyRow>
          )}
        </tbody>
      </table>
      <p className="muted">
        {branchName(branchId)}. Gamers book in the BaronDesk app; the list reloads every {POLL_MS / 1000} seconds. A booking can be cancelled
        until someone logs in on the PC, or until its no-show deadline (30 minutes after the start).
      </p>
    </>
  );
}
