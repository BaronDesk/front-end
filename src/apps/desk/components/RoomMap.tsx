import { Link } from 'react-router';

import type { Station } from '../../../core/api-types';
import { panelHeight, SEAT, seatLayout } from '../../../domain/seats';
import { isOnline, screenText, stationLabel } from '../../../domain/stations';
import { cx } from '../../../lib/cx';
import styles from './RoomMap.module.css';

/** The phone's seat map (positions in design px), scaled up for the desk. */
const SCALE = 1.6;
/** Room above the first row: the phone's panel keeps its pills there, the desk only a margin. */
const TOP = 16;
const WIDTH = 304;

const px = (figma: number) => `${figma * SCALE}px`;

type State = 'free' | 'session' | 'booked' | 'offline';

const STATE_TEXT: Record<State, string> = { free: 'Free', session: 'In session', booked: 'Booked', offline: 'Offline' };

/**
 * A time slot to show the room at (the Bookings page's pickers): `now` the
 * slot starts now; `booked` the stations a booking holds in it.
 */
export interface RoomSlot {
  now: boolean;
  booked: ReadonlySet<string>;
}

/**
 * A seat's state. Without a slot: what the station does now. With a slot, as
 * in the app: a booking makes it red; now, a running session comes first and
 * an offline station shows so; later, only free or booked.
 */
function stateOf(s: Station, slot: RoomSlot | undefined): State {
  if (slot && !slot.now) return slot.booked.has(s.id) ? 'booked' : 'free';
  if (s.sessionId) return 'session';
  if (slot?.booked.has(s.id)) return 'booked';
  if (!isOnline(s)) return 'offline';
  return 'free';
}

/**
 * A branch's room as the gamers see it in the app: the stations at the
 * phone's seat positions (rows of 2 and 3, numbered in the same order), each
 * colored by its state. `stations` must already be in seat order (roomsOf).
 * `alertsOf`: open alerts per station (a red dot; no dots nor legend line
 * without it). `linkOf`: where a seat leads (its station by default).
 */
export function RoomMap({
  stations,
  slot,
  alertsOf,
  linkOf = (s) => `/stations/${s.id}`,
}: {
  stations: Station[];
  slot?: RoomSlot;
  alertsOf?(machineId: string): number;
  linkOf?(s: Station): string;
}) {
  const seats = seatLayout(stations.length);
  const offset = (seats[0]?.y ?? 0) - TOP;
  const counts: Record<State, number> = { free: 0, session: 0, booked: 0, offline: 0 };
  for (const s of stations) counts[stateOf(s, slot)]++;
  // The legend lists what can happen in this view.
  const shown: State[] = !slot ? ['free', 'session', 'offline'] : slot.now ? ['free', 'session', 'booked', 'offline'] : ['free', 'booked'];

  return (
    <div className={styles.room}>
      <div className={styles.map} style={{ width: px(WIDTH), height: px(panelHeight(stations.length) - offset) }}>
        {stations.map((s, i) => {
          const at = seats[i];
          const state = stateOf(s, slot);
          const alerts = alertsOf?.(s.id) ?? 0;
          return (
            <Link
              key={s.id}
              to={linkOf(s)}
              className={cx(styles.seat, styles[state])}
              style={{ left: px(at.x), top: px(at.y - offset), width: px(SEAT), height: px(SEAT) }}
              title={`${stationLabel(s)} · ${STATE_TEXT[state]}${slot && !slot.now ? '' : ` · ${screenText(s.locked)}`}${alerts ? ` · ${alerts} open alert${alerts > 1 ? 's' : ''}` : ''}`}
              aria-label={`Seat ${i + 1}: ${stationLabel(s)}, ${STATE_TEXT[state]}`}
            >
              {i + 1}
              {alerts > 0 && <span className={styles.alert} aria-hidden="true" />}
            </Link>
          );
        })}
      </div>

      <ul className={styles.legend}>
        {shown.map((state) => (
          <li key={state}>
            <span className={cx(styles.key, styles[state])} /> {STATE_TEXT[state]} <b>{counts[state]}</b>
          </li>
        ))}
        {alertsOf && (
          <li>
            <span className={cx(styles.key, styles.free)}>
              <span className={styles.alert} />
            </span>{' '}
            Open alert
          </li>
        )}
      </ul>
    </div>
  );
}
