import { useRealtime } from '../../../providers/RealtimeProvider';

/** Red bar while live updates are down; it goes once the socket reconnects. */
export function ConnectionBanner() {
  const { state, everConnected } = useRealtime();

  if (state === 'connected') return null;
  if (state === 'connecting' && !everConnected) return null; // first connect in progress
  return (
    <div className="banner" role="status">
      {everConnected
        ? 'Connection to the server lost. Reconnecting… Live data on this page may be out of date.'
        : 'Live updates are not available. Retrying…'}
    </div>
  );
}

/** "LIVE" / "OFFLINE" tag for the header. */
export function LiveTag() {
  const { state } = useRealtime();
  return state === 'connected' ? (
    <span className="live-tag live-on" title="Live updates connected">
      LIVE
    </span>
  ) : (
    <span className="live-tag live-off" title={`Live updates: ${state}`}>
      {state === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
    </span>
  );
}
