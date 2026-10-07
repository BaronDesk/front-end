import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { api } from '../../api/http';
import type { Branch, BranchStation, CheckIn, Reservation, WalkIn } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { explainRefusal } from '../../shared/lib/errors';
import { formatClock, formatDateTime } from '../../shared/lib/format';
import { ActionMessages } from '../../shared/components/ActionMessages';
import { useAction } from '../../shared/hooks/useAction';
import { useApiQuery } from '../../shared/hooks/useApiQuery';
import { canCheckIn, isCancellable, knownStations, RESERVATION_TEXT, stationOf } from '../../shared/lib/bookings';
import { PinBox, requestPin } from './Pin';
import { EmptyRow } from '../../shared/components/EmptyRow';

const DURATIONS = [30, 60, 90, 120, 180];

/** "2026-10-01T18:00" for a datetime-local input: the next full hour. */
function nextHourLocal(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

/** The server's booking refusals, in words a gamer understands. */
const BOOKING_REFUSALS: Record<string, string> = {
  MACHINE_UNAVAILABLE: 'This PC is not available (for Play now it must be switched on). Try another one or ask the desk.',
  RESERVATION_SLOT_TAKEN: 'Someone already booked this PC for that time. Pick another time or PC.',
  GAMER_ALREADY_BOOKED: 'You already have a booking at that time: one PC at a time.',
  BOOKING_TOO_FAR_AHEAD: 'That is too far ahead for your plan. A higher membership lets you book further ahead.',
  INSUFFICIENT_FUNDS: 'Your balance does not cover this booking (your other bookings count too). Top up at the desk, or book less time.',
  PRICING_NOT_SET: 'This branch has no prices yet. Ask the desk.',
};

/** How a station reads in the picker: free now, busy until when, or off. */
function stationStatus(s: BranchStation): string {
  if (!s.online) return 'switched off';
  if (s.busyNow && s.busyUntil) return `busy until ${formatClock(s.busyUntil)}`;
  return 'free now';
}

const explain = (err: unknown) => explainRefusal(err, BOOKING_REFUSALS);

/**
 * Advance Reservation (brief §6.8). The stations are those of the gamer's
 * branch (Settings), each with whether it is free; the desk's booking link
 * (a QR code on a PC) preselects one, and PCs booked before stay listed. The
 * wallet must cover the booking. Every booking comes with its PIN, shown here:
 * it works on that PC from the booking's start until 30 minutes later (after
 * that the booking is a no-show and the PC is free again).
 */
export function BookPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const linkId = params.get('station');
  const linkName = params.get('name');
  const homeBranchId = user?.homeBranchId ?? null;
  const bookings = useApiQuery<Reservation[]>('/reservations');
  const branches = useApiQuery<Branch[]>('/branches');
  const branchStations = useApiQuery<BranchStation[]>(homeBranchId ? `/branches/${homeBranchId}/stations` : null);
  const stations = useMemo(() => {
    const fromBranch = (branchStations.data ?? []).map((s) => ({ id: s.id, label: `${s.name} — ${stationStatus(s)}` }));
    const others = knownStations(bookings.data, linkId ? { id: linkId, label: linkName ?? 'the PC from the link' } : null);
    const ids = new Set(fromBranch.map((s) => s.id));
    return [...fromBranch, ...others.filter((s) => !ids.has(s.id))];
  }, [branchStations.data, bookings.data, linkId, linkName]);
  const branchName = branches.data?.find((b) => b.id === homeBranchId)?.name;
  const action = useAction();
  const [machineId, setMachineId] = useState(linkId ?? '');
  const [start, setStart] = useState(nextHourLocal);
  const [minutes, setMinutes] = useState(60);
  const [made, setMade] = useState<Reservation | null>(null);
  const [pin, setPin] = useState<{ checkIn: CheckIn; station: string; validFrom: string } | null>(null);
  const station = machineId || stations[0]?.id || '';

  async function book(e: FormEvent) {
    e.preventDefault();
    const startTime = new Date(start);
    const body = { machineId: station, startTime: startTime.toISOString(), endTime: new Date(startTime.getTime() + minutes * 60_000).toISOString() };
    const r = await action.run('book', () => api<WalkIn>('POST', '/reservations', body).catch(explain), 'Booked.');
    if (r) {
      setMade(r);
      setPin(r.checkIn ? { checkIn: r.checkIn, station: stationOf(r), validFrom: r.startTime } : null);
      bookings.reload();
      branchStations.reload();
    }
  }

  async function playNow() {
    const r = await action.run(
      'now',
      () => api<WalkIn>('POST', '/reservations/walk-in', { machineId: station, durationMinutes: minutes }).catch(explain),
      (w) => (w.checkIn ? 'The PC is yours now: type the PIN below on its lock screen.' : 'The PC is yours now. No PIN yet: tap New PIN below in a moment.'),
    );
    if (r) {
      setMade(null);
      setPin(r.checkIn ? { checkIn: r.checkIn, station: stationOf(r), validFrom: r.startTime } : null);
      bookings.reload();
      branchStations.reload();
    }
  }

  async function getPin(r: Reservation) {
    if (r.pin && !window.confirm('Get a new PIN? The one you have stops working.')) return;
    const c = await action.run(r.id, () => requestPin(r));
    if (c) {
      setPin({ checkIn: c, station: stationOf(r), validFrom: r.startTime });
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
      <ErrorBox error={bookings.error ?? branchStations.error} />
      {homeBranchId ? (
        <p className="muted">
          Stations of {branchName ?? 'your branch'}. <Link to="/settings">Change branch</Link>
        </p>
      ) : (
        <p className="msg">
          Pick the branch you play at to see its stations: <Link to="/settings">Settings »</Link>
        </p>
      )}

      {pin && <PinBox pin={pin.checkIn.pin} station={pin.station} validFrom={pin.validFrom} validUntil={pin.checkIn.pinExpiresAt} />}
      {made && !pin && (
        <div className="msg">
          <b>{stationOf(made)}</b>, {formatDateTime(made.startTime)}. Your PIN will show on the booking below.
        </div>
      )}

      {stations.length === 0 ? (
        <p className="msg">
          {homeBranchId && branchStations.data
            ? 'This branch has no station to book yet.'
            : 'Scan the booking QR code on a PC (or ask the desk for its booking link) to book it.'}
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
            <th>PIN</th>
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
                {r.pin ? (
                  <>
                    <b className="pin">{r.pin.pin}</b>
                    <div className="muted">from {formatDateTime(r.pin.validFrom).split(' ')[1]}</div>
                  </>
                ) : (
                  <span className="muted">{r.status === 'ACTIVE' ? 'used' : '—'}</span>
                )}
              </td>
              <td className="nowrap">
                {canCheckIn(r) && (
                  <button type="button" className="secondary" disabled={action.busy === r.id} onClick={() => getPin(r)}>
                    New PIN
                  </button>
                )}{' '}
                {isCancellable(r) && (
                  <button type="button" className="secondary" disabled={action.busy === r.id} onClick={() => cancel(r)}>
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!bookings.loading && upcoming.length === 0 && (
            <EmptyRow colSpan={5}>No booking ahead.</EmptyRow>
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
