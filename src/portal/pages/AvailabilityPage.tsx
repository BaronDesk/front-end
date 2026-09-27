import { useEffect } from 'react';
import { Link } from 'react-router';

import type { StationAvailability } from '../../api/types';
import { ErrorBox } from '../../shared/ErrorBox';
import { formatClock, formatDateTime } from '../../shared/format';
import { useApiQuery } from '../../shared/useApiQuery';
import { BranchSelect, useBranchChoice } from '../branches';

/** Stations change state often; a gamer's phone gets no station events, so poll. */
const REFRESH_MS = 20_000;

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function AvailabilityPage() {
  const [branchId, setBranchId] = useBranchChoice();
  const list = useApiQuery<StationAvailability[]>(branchId ? `/stations/availability?branchId=${branchId}` : null);
  const { reload } = list;

  useEffect(() => {
    const id = setInterval(reload, REFRESH_MS);
    return () => clearInterval(id);
  }, [reload]);

  const stations = [...(list.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const free = stations.filter((s) => s.free).length;

  return (
    <>
      <h1>Free stations</h1>
      <div className="form-row">
        <label htmlFor="av-branch">Venue</label>
        <BranchSelect id="av-branch" value={branchId} onChange={setBranchId} />
      </div>
      <ErrorBox error={list.error} />

      {branchId && (
        <p>
          <b>{free}</b> of {stations.length} free right now.{' '}
          <button type="button" className="secondary" onClick={reload} disabled={list.loading}>
            {list.loading ? 'Loading…' : 'Refresh'}
          </button>
        </p>
      )}

      {stations.length > 0 && (
        <table className="grid">
          <thead>
            <tr>
              <th>Station</th>
              <th>Now</th>
              <th>Next booking</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.machineId}>
                <td>
                  <b>{s.name}</b>
                </td>
                <td className={s.free ? 'status-ok' : 'status-bad'}>{s.free ? 'FREE' : 'BUSY'}</td>
                <td>
                  {s.nextReservationAt ? (
                    isToday(s.nextReservationAt) ? (
                      formatClock(s.nextReservationAt).slice(0, 5)
                    ) : (
                      formatDateTime(s.nextReservationAt)
                    )
                  ) : (
                    <span className="muted">—</span>
                  )}{' '}
                  <Link to={`/book?branch=${s.branchId}&station=${s.machineId}`}>Book »</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">Busy = someone is playing, the PC is off, or a booking starts within 30 minutes.</p>
    </>
  );
}
