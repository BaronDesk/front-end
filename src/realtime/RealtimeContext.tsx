import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { DashboardEventName, DashboardEvents } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { getAccessToken } from '../auth/tokens';
import { createRealtime } from './createRealtime';
import type { ConnectionState, RealtimeSource } from './types';

interface RealtimeApi {
  source: RealtimeSource | null;
  state: ConnectionState;
  /** True once the first connection succeeded; the banner only warns after that. */
  everConnected: boolean;
  /** Increments on every reconnect after the first connect. Screens refetch when it changes. */
  reconnects: number;
}

const RealtimeContext = createContext<RealtimeApi | null>(null);

/** Connects to /dashboard-io while someone is logged in; disconnects on logout. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [source, setSource] = useState<RealtimeSource | null>(null);
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [everConnected, setEverConnected] = useState(false);
  const [reconnects, setReconnects] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void createRealtime().then((s) => !cancelled && setSource(s));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!source || !userId) return;
    let connectedBefore = false;
    const offState = source.onState((s) => {
      setState(s);
      if (s !== 'connected') return;
      if (connectedBefore) setReconnects((n) => n + 1);
      connectedBefore = true;
      setEverConnected(true);
    });
    source.connect(getAccessToken);
    return () => {
      offState();
      source.disconnect();
      setState('disconnected');
      setEverConnected(false);
    };
  }, [source, userId]);

  const value = useMemo(() => ({ source, state, everConnected, reconnects }), [source, state, everConnected, reconnects]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeApi {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return ctx;
}

/** Run `handler` for every `event`. The latest handler is always used; no re-subscribe needed. */
export function useRealtimeEvent<E extends DashboardEventName>(
  event: E,
  handler: (payload: DashboardEvents[E]) => void,
): void {
  const { source } = useRealtime();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => source?.on(event, (payload) => ref.current(payload)), [source, event]);
}

/** Run `refetch` after each reconnect, so lists catch up on events missed while offline. */
export function useOnReconnect(refetch: () => void): void {
  const { reconnects } = useRealtime();
  const ref = useRef(refetch);
  useEffect(() => {
    ref.current = refetch;
  });
  useEffect(() => {
    if (reconnects > 0) ref.current();
  }, [reconnects]);
}
