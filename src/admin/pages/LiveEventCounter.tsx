import { useState } from 'react';

import type { DashboardEventName } from '../../api/types';
import { useRealtimeEvent } from '../../realtime/RealtimeContext';

const EVENTS: DashboardEventName[] = ['station_status', 'telemetry_update', 'alert', 'session_update', 'command_result'];

interface Count {
  n: number;
  last: string | null;
}

function useCount(event: DashboardEventName): Count {
  const [count, setCount] = useState<Count>({ n: 0, last: null });
  useRealtimeEvent(event, () => setCount((c) => ({ n: c.n + 1, last: new Date().toLocaleTimeString() })));
  return count;
}

function Row({ event }: { event: DashboardEventName }) {
  const { n, last } = useCount(event);
  return (
    <tr>
      <td>
        <code>{event}</code>
      </td>
      <td>{n}</td>
      <td>{last ?? '—'}</td>
    </tr>
  );
}

/**
 * Temporary: shows that /dashboard-io events arrive while a page is still a
 * placeholder. Each page drops it when it's built (steps 5–8).
 */
export function LiveEventCounter() {
  return (
    <>
      <h2>Live events received on this page</h2>
      <table className="grid" style={{ width: 'auto' }}>
        <thead>
          <tr>
            <th>Event</th>
            <th>Count</th>
            <th>Last at</th>
          </tr>
        </thead>
        <tbody>
          {EVENTS.map((e) => (
            <Row key={e} event={e} />
          ))}
        </tbody>
      </table>
    </>
  );
}
