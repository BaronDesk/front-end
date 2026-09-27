import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Alert } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';

interface AlertFeed {
  /** Alerts nobody has acknowledged yet (menu count). */
  openCount: number;
  /** Alerts that arrived live and haven't been looked at (banner), newest first. */
  unseen: Alert[];
  dismissAll(): void;
  /** Tell the feed an alert changed status on the Alerts page. */
  update(alert: Alert): void;
}

const AlertFeedContext = createContext<AlertFeed | null>(null);

const MAX_UNSEEN = 20;

export function AlertFeedProvider({ children }: { children: ReactNode }) {
  // Menu count and banner follow HQ's branch choice, like every list.
  const { scoped, inScope } = useBranchScope();
  const open = useApiQuery<Alert[]>(scoped('/alerts?status=OPEN'));
  const [unseen, setUnseen] = useState<Alert[]>([]);

  useRealtimeEvent('alert', (a) => {
    if (!inScope(a.branchId)) return;
    open.setData((list) => [a, ...(list ?? []).filter((x) => x.id !== a.id)]);
    setUnseen((u) => [a, ...u.filter((x) => x.id !== a.id)].slice(0, MAX_UNSEEN));
  });
  useOnReconnect(open.reload);

  const { setData } = open;
  const update = useCallback(
    (alert: Alert) => {
      setData((list) => (list ?? []).filter((x) => x.id !== alert.id || alert.status === 'OPEN'));
      setUnseen((u) => u.filter((x) => x.id !== alert.id));
    },
    [setData],
  );
  const dismissAll = useCallback(() => setUnseen((u) => (u.length ? [] : u)), []);

  const openCount = open.data?.length ?? 0;
  const value = useMemo(() => ({ openCount, unseen, dismissAll, update }), [openCount, unseen, dismissAll, update]);
  return <AlertFeedContext.Provider value={value}>{children}</AlertFeedContext.Provider>;
}

export function useAlertFeed(): AlertFeed {
  const ctx = useContext(AlertFeedContext);
  if (!ctx) throw new Error('useAlertFeed must be used inside <AlertFeedProvider>');
  return ctx;
}
