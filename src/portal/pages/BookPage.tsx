import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { api, newIdempotencyKey } from '../../api/http';
import type { Pricing, Reservation, StationAvailability } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { formatDateTime, formatMoney } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { BranchSelect, useBranchChoice } from '../branches';

const STATUS_TEXT: Record<Reservation['status'], string> = {
  BOOKED: 'Booked',
  CHECKED_IN: 'Checked in',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'Missed',
};

function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The next full hour, e.g. "18:00". */
function nextHour(): string {
  return `${String((new Date().getHours() + 1) % 24).padStart(2, '0')}:00`;
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Remote booking (brief §6.8). The server rejects a double booking with 409. */
export function BookPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [branchId, setBranchId] = useBranchChoice();
  // Every station, so "my bookings" can name stations in any venue.
  const all = useApiQuery<StationAvailability[]>('/stations/availability');
  const mine = useApiQuery<Reservation[]>('/me/reservations');
  const pricing = useApiQuery<Pricing>('/pricing');
  const action = useAction();

  const [form, setForm] = useState({ machineId: params.get('station') ?? '', date: localDate(), time: nextHour(), hours: '2' });
  const [bookKey, setBookKey] = useState(newIdempotencyKey);

  const stations = (all.data ?? []).filter((s) => s.branchId === branchId).sort((a, b) => a.name.localeCompare(b.name));
  const stationName = (id: string) => all.data?.find((s) => s.machineId === id)?.name ?? id.slice(0, 8);
  const upcoming = (mine.data ?? []).filter((r) => r.status === 'BOOKED').sort((a, b) => a.start.localeCompare(b.start));
  const past = (mine.data ?? []).filter((r) => r.status !== 'BOOKED').slice(0, 10);

  function changeBranch(id: string) {
    setBranchId(id);
    setForm((f) => ({ ...f, machineId: '' }));
  }

  async function book(e: FormEvent) {
    e.preventDefault();
    const start = new Date(`${form.date}T${form.time}`);
    const end = new Date(start.getTime() + Number(form.hours) * 3_600_000);
    const created = await action.run(
      'book',
      () =>
        api<Reservation>('POST', '/reservations', {
          userId: user?.id,
          machineId: form.machineId,
          start: start.toISOString(),
          end: end.toISOString(),
          idempotencyKey: bookKey,
        }),
      (r) => `Booked ${stationName(r.machineId)}, ${formatDateTime(r.start)} to ${hhmm(r.end)}.`,
    );
    if (created) {
      setBookKey(newIdempotencyKey());
      mine.reload();
    }
  }

  async function cancel(r: Reservation) {
    if (!window.confirm(`Cancel ${stationName(r.machineId)} on ${formatDateTime(r.start)}?`)) return;
    const done = await action.run(r.id, () => api('DELETE', `/reservations/${r.id}`).then(() => true), 'Booking cancelled.');
    if (done) mine.reload();
  }

  return (
    <>
      <h1>Book a station</h1>
      <ActionMessages action={action} />

      <form onSubmit={book}>
        <fieldset>
          <legend>New booking</legend>
          <div className="form-row">
            <label htmlFor="bk-branch">Venue</label>
            <BranchSelect id="bk-branch" value={branchId} onChange={changeBranch} />
          </div>
          <div className="form-row">
            <label htmlFor="bk-station">Station</label>
            <select id="bk-station" required value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })}>
              <option value="">{all.loading ? 'loading…' : '— choose a station —'}</option>
              {stations.map((s) => (
                <option key={s.machineId} value={s.machineId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="bk-date">Day</label>
            <input id="bk-date" type="date" required min={localDate()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="bk-time">Start</label>
            <input id="bk-time" type="time" required step={900} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="bk-hours">Hours</label>
            <select id="bk-hours" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })}>
              {[1, 2, 3, 4, 5, 6].map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </div>
          {pricing.data && pricing.data.bookingFee > 0 && (
            <p className="muted">
              Booking fee {formatMoney(pricing.data.bookingFee)}, taken from your wallet now. Refunded if you cancel at least 1 hour before the
              start. Play time is billed at the venue.
            </p>
          )}
          <button type="submit" className="wide" disabled={action.busy === 'book'}>
            {action.busy === 'book' ? 'Booking…' : 'Book'}
          </button>
        </fieldset>
      </form>

      <h2>My bookings</h2>
      {upcoming.length === 0 && <p className="muted">{mine.loading ? 'Loading…' : 'No upcoming bookings.'}</p>}
      {upcoming.length > 0 && (
        <table className="grid">
          <thead>
            <tr>
              <th>When</th>
              <th>Station</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {upcoming.map((r) => (
              <tr key={r.id}>
                <td>
                  {formatDateTime(r.start)}–{hhmm(r.end)}
                </td>
                <td>{stationName(r.machineId)}</td>
                <td>
                  <button type="button" className="secondary" disabled={action.busy === r.id} onClick={() => cancel(r)}>
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {past.length > 0 && (
        <>
          <h2>Earlier</h2>
          <table className="grid">
            <tbody>
              {past.map((r) => (
                <tr key={r.id} className="row-muted">
                  <td>{formatDateTime(r.start)}</td>
                  <td>{stationName(r.machineId)}</td>
                  <td>{STATUS_TEXT[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
