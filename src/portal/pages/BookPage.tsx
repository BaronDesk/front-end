import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { api, ApiError } from '../../api/http';
import type { Reservation } from '../../api/types';
import { CopyButton } from '../../shared/CopyButton';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatDateTime } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { isCancellable, knownStations, RESERVATION_TEXT, stationOf } from '../bookings';

const DURATIONS = [30, 60, 90, 120, 180];

/** "2026-10-01T18:00" for a datetime-local input: the next full hour. */
function nextHourLocal(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

/** The server's refusals, in words a gamer understands. */
function explain(err: unknown): never {
  if (err instanceof ApiError && err.code === 'MACHINE_UNAVAILABLE') {
    throw new Error('This PC is not available right now (it must be switched on and approved to be booked). Try another one or ask the desk.');
  }
  throw err;
}

/**
 * Advance Reservation (brief §6.8). A gamer can't list stations on the
 * backend, so the station comes from the desk's booking link (a QR code on
 * the PC) or from the gamer's earlier bookings. Every booking has a booking
 * code: the desk starts the session with it and gives back the PIN.
 */
export function BookPage() {
  const [params] = useSearchParams();
  const linkId = params.get('station');
  const linkName = params.get('name');
  const bookings = useApiQuery<Reservation[]>('/reservations');
  const stations = useMemo(
    () => knownStations(bookings.data, linkId ? { id: linkId, label: linkName ?? 'the PC from the link' } : null),
    [bookings.data, linkId, linkName],
  );
  const action = useAction();
  const [machineId, setMachineId] = useState(linkId ?? '');
  const [start, setStart] = useState(nextHourLocal);
  const [minutes, setMinutes] = useState(60);
  const [made, setMade] = useState<Reservation | null>(null);
  const station = machineId || stations[0]?.id || '';

  async function book(e: FormEvent) {
    e.preventDefault();
    const startTime = new Date(start);
    const body = { machineId: station, startTime: startTime.toISOString(), endTime: new Date(startTime.getTime() + minutes * 60_000).toISOString() };
    const r = await action.run('book', () => api<Reservation>('POST', '/reservations', body).catch(explain), 'Booked. Your booking code is below.');
    if (r) {
      setMade(r);
      bookings.reload();
    }
  }

  async function playNow() {
    const r = await action.run(
      'now',
      () => api<Reservation>('POST', '/reservations/walk-in', { machineId: station, durationMinutes: minutes }).catch(explain),
      'The PC is yours now: show the booking code at the desk to get your PIN.',
    );
    if (r) {
      setMade(r);
      bookings.reload();
    }
  }

  async function cancel(r: Reservation) {
    if (!window.confirm(`Cancel your booking on ${stationOf(r)}, ${formatDateTime(r.startTime)}?`)) return;
    const done = await action.run(r.id, () => api('DELETE', `/reservations/${r.id}`).then(() => true), 'Booking cancelled.');
    if (done) bookings.reload();
  }

  const list = bookings.data ?? [];
  const upcoming = list.filter((r) => r.status === 'CONFIRMED' || r.status === 'PENDING' || r.status === 'ACTIVE');
  const past = list.filter((r) => !upcoming.includes(r)).slice(0, 10);

  return (
    <>
      <h1>Book a station</h1>
      <ActionMessages action={action} />
      <ErrorBox error={bookings.error} />

      {made && (
        <div className="msg">
          <b>Booking code</b> ({stationOf(made)}, {formatDateTime(made.startTime)}):
          <pre className="token">{made.id}</pre>
          <CopyButton text={made.id} /> Show it at the desk when you arrive: they start your session and give you the PIN for the PC.
        </div>
      )}

      {stations.length === 0 ? (
        <p className="msg">
          Scan the booking QR code on a PC (or ask the desk for its booking link) to book it. PCs you booked before show up here.
        </p>
      ) : (
        <form onSubmit={book}>
          <fieldset>
            <legend>New booking</legend>
            <div className="form-row">
              <label htmlFor="bk-station">Station</label>
              <select id="bk-station" value={station} onChange={(e) => setMachineId(e.target.value)}>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="bk-minutes">How long</label>
              <select id="bk-minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <button type="button" disabled={action.busy === 'now'} onClick={playNow}>
                Play now
              </button>
            </div>
            <div className="form-row">
              <label htmlFor="bk-start">Or from</label>
              <input id="bk-start" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="form-row">
              <button type="submit" disabled={action.busy === 'book'}>
                Book for later
              </button>
            </div>
          </fieldset>
        </form>
      )}

      <h2>My bookings</h2>
      <table className="grid">
        <thead>
          <tr>
            <th>Station</th>
            <th>When</th>
            <th>Status</th>
            <th>Booking code</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {upcoming.map((r) => (
            <tr key={r.id}>
              <td>{stationOf(r)}</td>
              <td>
                {formatDateTime(r.startTime)} – {formatDateTime(r.endTime).split(' ')[1]}
              </td>
              <td>{RESERVATION_TEXT[r.status]}</td>
              <td>
                <code>{r.id.slice(0, 8)}…</code> <CopyButton text={r.id} />
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
          {!bookings.loading && upcoming.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No booking ahead.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {past.length > 0 && (
        <>
          <h2>Before</h2>
          <table className="grid">
            <tbody>
              {past.map((r) => (
                <tr key={r.id} className="row-muted">
                  <td>{stationOf(r)}</td>
                  <td>{formatDateTime(r.startTime)}</td>
                  <td>{RESERVATION_TEXT[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
