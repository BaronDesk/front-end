import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { api, newIdempotencyKey } from '../../api/http';
import type { Reservation, ReservationStatus, SessionView, Station } from '../../api/types';
import { useOnReconnect } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { GamerSelect, StationSelect } from '../pickers';
import { stationLabel, STATIONS_PATH } from '../stations/station';
import { useGamerNames } from '../useLookups';

/** Hours shown in the day grid. */
const FIRST_HOUR = 8;
const LAST_HOUR = 24;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);

const STATUS_LABEL: Record<ReservationStatus, string> = {
  BOOKED: 'Booked',
  CHECKED_IN: 'Checked in',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Advance reservation (brief §6.8): day grid per station, list, create, check-in, cancel. */
export function ReservationsPage() {
  const [date, setDate] = useState(localDate);
  const { scoped } = useBranchScope();
  const reservations = useApiQuery<Reservation[]>(scoped(`/reservations?date=${date}`));
  const stations = useApiQuery<Station[]>(scoped(STATIONS_PATH));
  const gamerNames = useGamerNames();
  const action = useAction();
  useOnReconnect(reservations.reload);

  const [form, setForm] = useState({ userId: '', machineId: '', time: '18:00', hours: '2' });
  const [bookKey, setBookKey] = useState(newIdempotencyKey);

  const list = reservations.data ?? [];
  const stationName = (id: string) => {
    const s = stations.data?.find((x) => x.id === id);
    return s ? stationLabel(s) : id.slice(0, 8);
  };
  const sortedStations = [...(stations.data ?? [])].sort((a, b) => stationLabel(a).localeCompare(stationLabel(b)));

  function cell(machineId: string, hour: number): Reservation | undefined {
    const from = new Date(`${date}T00:00`);
    from.setHours(hour);
    const to = new Date(from.getTime() + 3_600_000);
    return list.find(
      (r) => r.machineId === machineId && r.status !== 'CANCELLED' && Date.parse(r.start) < to.getTime() && Date.parse(r.end) > from.getTime(),
    );
  }

  async function book(e: FormEvent) {
    e.preventDefault();
    const start = new Date(`${date}T${form.time}`);
    const end = new Date(start.getTime() + Number(form.hours) * 3_600_000);
    const created = await action.run(
      'book',
      () =>
        api<Reservation>('POST', '/reservations', {
          userId: form.userId,
          machineId: form.machineId,
          start: start.toISOString(),
          end: end.toISOString(),
          idempotencyKey: bookKey,
        }),
      (r) => `Booked ${stationName(r.machineId)} for ${gamerNames.get(r.userId) ?? 'the gamer'}, ${hhmm(r.start)}–${hhmm(r.end)}.`,
    );
    if (created) {
      setBookKey(newIdempotencyKey());
      reservations.reload();
    }
  }

  async function checkIn(r: Reservation) {
    const session = await action.run(
      r.id,
      () => api<SessionView>('POST', `/reservations/${r.id}/checkin`),
      () => `Checked in: session started on ${stationName(r.machineId)}. The station unlocks.`,
    );
    if (session) reservations.reload();
  }

  async function cancel(r: Reservation) {
    if (!window.confirm(`Cancel the booking of ${gamerNames.get(r.userId) ?? 'this gamer'} on ${stationName(r.machineId)}?`)) return;
    const done = await action.run(r.id, () => api('DELETE', `/reservations/${r.id}`).then(() => true), 'Booking cancelled.');
    if (done) reservations.reload();
  }

  return (
    <>
      <h1>Reservations</h1>
      <div className="toolbar">
        <label htmlFor="r-date">Day</label>
        <input id="r-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />{' '}
        <button type="button" className="secondary" onClick={() => setDate(localDate())}>
          Today
        </button>{' '}
        <button type="button" className="secondary" onClick={reservations.reload}>
          Refresh
        </button>
        {reservations.loading && <span className="muted"> loading…</span>}
      </div>
      <ActionMessages action={action} />
      <ErrorBox error={reservations.error} />

      <h2>Day view</h2>
      <div className="scroll-x">
        <table className="grid timeline">
          <thead>
            <tr>
              <th>Station</th>
              {HOURS.map((h) => (
                <th key={h}>{String(h % 24).padStart(2, '0')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStations.map((s) => (
              <tr key={s.id}>
                <td>
                  <b>{stationLabel(s)}</b>
                </td>
                {HOURS.map((h) => {
                  const r = cell(s.id, h);
                  return (
                    <td
                      key={h}
                      className={r ? (r.status === 'BOOKED' ? 'slot-booked' : 'slot-used') : ''}
                      title={r ? `${gamerNames.get(r.userId) ?? ''} ${hhmm(r.start)}–${hhmm(r.end)} (${STATUS_LABEL[r.status]})` : ''}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        <span className="slot-booked legend-box" /> booked &nbsp; <span className="slot-used legend-box" /> checked in
      </p>

      <div className="columns">
        <div>
          <h2>Bookings</h2>
          <table className="grid">
            <thead>
              <tr>
                <th>Time</th>
                <th>Station</th>
                <th>Gamer</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={r.status === 'CANCELLED' ? 'row-muted' : ''}>
                  <td className="nowrap">
                    {hhmm(r.start)}–{hhmm(r.end)}
                  </td>
                  <td>{stationName(r.machineId)}</td>
                  <td>{gamerNames.get(r.userId) ?? '—'}</td>
                  <td>{STATUS_LABEL[r.status]}</td>
                  <td className="nowrap">
                    {r.status === 'BOOKED' ? (
                      <>
                        <button type="button" disabled={action.busy === r.id} onClick={() => checkIn(r)}>
                          Check in
                        </button>{' '}
                        <button type="button" className="secondary" disabled={action.busy === r.id} onClick={() => cancel(r)}>
                          Cancel
                        </button>
                      </>
                    ) : r.status === 'CHECKED_IN' ? (
                      <Link to="/sessions">Sessions »</Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!reservations.loading && list.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No bookings on this day.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={book}>
          <h2>New booking</h2>
          <fieldset>
            <legend>Book a station on {date}</legend>
            <div className="form-row">
              <label htmlFor="b-gamer">Gamer</label>
              <GamerSelect id="b-gamer" required value={form.userId} onChange={(v) => setForm({ ...form, userId: v })} />
            </div>
            <div className="form-row">
              <label htmlFor="b-station">Station</label>
              <StationSelect id="b-station" required value={form.machineId} onChange={(v) => setForm({ ...form, machineId: v })} />
            </div>
            <div className="form-row">
              <label htmlFor="b-time">From</label>
              <input id="b-time" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor="b-hours">For</label>
              <select id="b-hours" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })}>
                {[1, 2, 3, 4, 5, 6].map((h) => (
                  <option key={h} value={h}>
                    {h} hour{h > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label />
              <button type="submit" disabled={action.busy === 'book'}>
                {action.busy === 'book' ? 'Booking…' : 'Book'}
              </button>
            </div>
          </fieldset>
          <p className="muted">The booking fee is taken from the gamer's wallet. Cancelling at least an hour before refunds it.</p>
        </form>
      </div>
    </>
  );
}
