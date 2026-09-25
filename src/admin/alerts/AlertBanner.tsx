import { Link, useLocation } from 'react-router';

import { useStationNames } from '../useLookups';
import { useAlertFeed } from './AlertFeedContext';
import { typeLabel } from './labels';

/** Red bar for alerts that just arrived (brief §6.5: alert → toast + list). Hidden on the Alerts page itself. */
export function AlertBanner() {
  const { unseen, dismissAll } = useAlertFeed();
  const { pathname } = useLocation();
  const stationNames = useStationNames();

  if (unseen.length === 0 || pathname === '/alerts') return null;
  const latest = unseen[0];
  const more = unseen.length - 1;

  return (
    <div className="banner banner-alert" role="alert">
      NEW ALERT: {stationNames.get(latest.machineId) ?? 'a station'} &middot; {typeLabel(latest.type)} ({latest.severity}) &middot;{' '}
      {latest.detail}
      {more > 0 && ` (+${more} more)`}
      <span className="banner-actions">
        <Link to="/alerts">View alerts</Link> &nbsp;|&nbsp;{' '}
        <a
          href="#dismiss"
          onClick={(e) => {
            e.preventDefault();
            dismissAll();
          }}
        >
          Dismiss
        </a>
      </span>
    </div>
  );
}
