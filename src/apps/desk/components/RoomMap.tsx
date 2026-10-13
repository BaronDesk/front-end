import { Link } from 'react-router';

import type { Station } from '../../../core/api-types';
import { panelHeight, SEAT, seatLayout } from '../../../domain/seats';
import { isOnline, screenText, stationLabel } from '../../../domain/stations';
import { cx } from '../../../lib/cx';
import styles from './RoomMap.module.css';

/** The phone's room drawing (Figma px) at this size on the desk. */
const SCALE = 1.6;
/** Room above the first row: the phone's panel keeps its pills there, the desk only a margin. */
const TOP = 16;
const WIDTH = 304;

const px = (figma: number) => `${figma * SCALE}px`;

/** A seat's state, in the colors of the legend. */
function stateOf(s: Station): 'offline' | 'session' | 'free' {
  if (!isOnline(s)) return 'offline';
  return s.sessionId ? 'session' : 'free';
}

const STATE_TEXT = { offline: 'Offline', session: 'In session', free: 'Online, free' } as const;

/**
 * A branch's room as the gamers see it in the app: the stations at the
 * phone's seat positions (rows of 2 and 3, numbered in the same order), each
 * colored by its state; a red dot for open alerts.
 * `stations` must already be in seat order (seatOrder).
 */
/** `alertsOf`: open alerts per station (no dots nor legend line without it); `linkOf`: where a seat leads (its station by default). */
export function RoomMap({ stations, alertsOf, linkOf = (s) => `/stations/${s.id}` }: { stations: Station[]; alertsOf?(machineId: string): number; linkOf?(s: Station): string }) {
  const seats = seatLayout(stations.length);
  const offset = (seats[0]?.y ?? 0) - TOP;
  const counts = { free: 0, session: 0, offline: 0 };
  for (const s of stations) counts[stateOf(s)]++;

  return (
    <div className={styles.room}>
      <div className={styles.map} style={{ width: px(WIDTH), height: px(panelHeight(stations.length) - offset) }}>
        {stations.map((s, i) => {
          const at = seats[i];
          const state = stateOf(s);
          const alerts = alertsOf?.(s.id) ?? 0;
          return (
            <Link
              key={s.id}
              to={linkOf(s)}
              className={cx(styles.seat, styles[state])}
              style={{ left: px(at.x), top: px(at.y - offset), width: px(SEAT), height: px(SEAT) }}
              title={`${stationLabel(s)} · ${STATE_TEXT[state]} · ${screenText(s.locked)}${alerts ? ` · ${alerts} open alert${alerts > 1 ? 's' : ''}` : ''}`}
              aria-label={`Seat ${i + 1}: ${stationLabel(s)}, ${STATE_TEXT[state]}`}
            >
              {i + 1}
              {alerts > 0 && <span className={styles.alert} aria-hidden="true" />}
            </Link>
          );
        })}
      </div>

      <ul className={styles.legend}>
        <li>
          <span className={cx(styles.key, styles.free)} /> Online, free <b>{counts.free}</b>
        </li>
        <li>
          <span className={cx(styles.key, styles.session)} /> In session <b>{counts.session}</b>
        </li>
        <li>
          <span className={cx(styles.key, styles.offline)} /> Offline <b>{counts.offline}</b>
        </li>
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
