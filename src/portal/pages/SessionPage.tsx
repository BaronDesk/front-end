import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import type { CheckIn, Reservation, Wallet, WalletEntry } from '../../api/types';
import { useRealtimeEvent } from '../../realtime/RealtimeContext';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatClock, formatDateTime, formatDuration, formatMillimes, formatSignedMillimes, secondsSince, useNow } from '../../shared/format';
import { ActionMessages, useAction } from '../../shared/useAction';
import { useApiQuery } from '../../shared/useApiQuery';
import { currentBooking, RESERVATION_TEXT, stationOf } from '../bookings';
import { PinBox, requestPin } from '../Pin';

/** No gamer session endpoint or event: the page re-reads the booking and the wallet this often. */
const POLL_MS = 15_000;

/**
 * My session (brief §6.6), from what a gamer may read: the running booking
 * (ACTIVE while the session runs), the wallet, and the session charges in it.
 * Time and cost of a running session are the desk's; the bill lands in the
 * wallet when it ends.
 */
export function SessionPage() {
  const bookings = useApiQuery<Reservation[]>('/reservations');
  const wallet = useApiQuery<Wallet>('/wallets/me');
  const entries = useApiQuery<WalletEntry[]>('/wallets/me/entries?take=30');
  const now = useNow(1_000);
  const [lowBalance, setLowBalance] = useState(false);
  const action = useAction();
  const [pin, setPin] = useState<CheckIn | null>(null);
  const booking = currentBooking(bookings.data, now);

  const { reload: reloadBookings } = bookings;
  const { reload: reloadWallet } = wallet;
  const { reload: reloadEntries } = entries;
  useEffect(() => {
    const timer = setInterval(() => {
      reloadBookings();
      reloadWallet();
      reloadEntries();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [reloadBookings, reloadWallet, reloadEntries]);

  // The runout timer's warning names the machine: it is ours if we are playing on it.
  useRealtimeEvent('session_runout_warning', (e) => {
    if (booking && e.machineId === booking.machineId) setLowBalance(true);
  });

  async function getPin(r: Reservation) {
    const c = await action.run('pin', () => requestPin(r));
    if (c) setPin(c);
  }

  const charges = (entries.data ?? []).filter((x) => x.sessionId).slice(0, 5);

  return (
    <>
      <h1>My session</h1>
      <ErrorBox error={bookings.error ?? wallet.error} />
      {lowBalance && (
        <div className="msg msg-error">
          <b>Low balance:</b> your session ends soon and the PC locks. Top up at the desk to keep playing.
        </div>
      )}

      <ActionMessages action={action} />
      {booking && booking.status !== 'ACTIVE' && pin?.reservationId === booking.id && <PinBox checkIn={pin} station={stationOf(booking)} />}

      {booking ? (
        <table className="kv">
          <tbody>
            <tr>
              <th>Station</th>
              <td>
                <b>{stationOf(booking)}</b>
              </td>
            </tr>
            <tr>
              <th>Status</th>
              <td className={booking.status === 'ACTIVE' ? 'status-ok' : ''}>{RESERVATION_TEXT[booking.status]}</td>
            </tr>
            <tr>
              <th>Booked</th>
              <td>
                {formatClock(booking.startTime)} – {formatClock(booking.endTime)}
                {booking.status === 'ACTIVE' && (
                  <span className="muted"> · {formatDuration(secondsSince(booking.startTime, now))} since the start of the booking</span>
                )}
              </td>
            </tr>
            <tr>
              <th>Balance</th>
              <td>{wallet.data ? formatMillimes(wallet.data.balance) : '…'}</td>
            </tr>
            {booking.status !== 'ACTIVE' && (
              <tr>
                <th>PIN</th>
                <td>
                  <button type="button" disabled={action.busy === 'pin'} onClick={() => getPin(booking)}>
                    {pin?.reservationId === booking.id ? 'Get a new PIN' : 'Get my PIN'}
                  </button>
                  <div className="muted">Type it on the PC&apos;s lock screen to start playing.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <p>
          You are not playing now. <Link to="/book">Book a station »</Link>
        </p>
      )}

      <h2>Last sessions</h2>
      <table className="grid">
        <tbody>
          {charges.map((x) => (
            <tr key={x.id}>
              <td>{formatDateTime(x.createdAt)}</td>
              <td>Play time</td>
              <td className="status-bad">{formatSignedMillimes(x.amount)}</td>
            </tr>
          ))}
          {!entries.loading && charges.length === 0 && (
            <tr>
              <td className="muted">No session billed yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
