import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Alert } from '../../api/types';
import { useOnReconnect, useRealtimeEvent } from '../../realtime/RealtimeContext';
import { useApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { ALERTS_PATH } from './labels';

interface AlertFeed {
  /** Alerts nobody has resolved yet (menu count). */
  openCount: number;
  /** Alerts that arrived live and haven't been looked at (banner), newest first. */
  unseen: Alert[];
  dismissAll(): void;
  /** Tell the feed an alert changed on the Alerts page. */
  update(alert: Alert): void;
}

const AlertFeedContext = createContext<AlertFeed | null>(null);

const MAX_UNSEEN = 20;

export function AlertFeedProvider({ children }: { children: ReactNode }) {
  // Menu count and banner follow HQ's branch choice, like every list.
  const { scoped, inScope } = useBranchScope();
  const open = useApiQuery<Alert[]>(scoped(`${ALERTS_PATH}?status=open&limit=500`));
  const [unseen, setUnseen] = useState<Alert[]>([]);
  const { setData } = open;

  const update = useCallback(
    (alert: Alert) => {
      if (alert.acknowledged) {
        setData((list) => list?.filter((x) => x.id !== alert.id));
        setUnseen((u) => u.filter((x) => x.id !== alert.id));
      } else {
        setData((list) => [alert, ...(list ?? []).filter((x) => x.id !== alert.id)]);
      }
    },
    [setData],
  );

  // A repeat of an open alert comes back with the same id: it shows in the banner again.
  useRealtimeEvent('alert', (a) => {
    if (!inScope(a.branchId)) return;
    update(a);
    if (!a.acknowledged) setUnseen((u) => [a, ...u.filter((x) => x.id !== a.id)].slice(0, MAX_UNSEEN));
  });
  // Resolved by anyone (another staff member, another tab).
  useRealtimeEvent('alert_resolved', (a) => inScope(a.branchId) && update(a));
  useOnReconnect(open.reload);

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
