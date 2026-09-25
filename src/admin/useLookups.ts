import { useMemo } from 'react';

import type { Branch, PublicUser, Station } from '../api/types';
import { useApiQuery } from '../shared/useApiQuery';

/** id → username for gamers, to show "who is playing". */
export function useGamerNames(): Map<string, string> {
  const { data } = useApiQuery<PublicUser[]>('/users?role=GAMER');
  return useMemo(() => new Map((data ?? []).map((u) => [u.id, u.username])), [data]);
}

/** id → station name, for pages that only have machine ids (alerts). */
export function useStationNames(): Map<string, string> {
  const { data } = useApiQuery<Station[]>('/stations');
  return useMemo(() => new Map((data ?? []).map((s) => [s.id, s.name])), [data]);
}

/** id → branch name. Only fetched when `enabled` (HQ sees several branches). */
export function useBranchNames(enabled: boolean): Map<string, string> {
  const { data } = useApiQuery<Branch[]>(enabled ? '/branches' : null);
  return useMemo(() => new Map((data ?? []).map((b) => [b.id, b.name])), [data]);
}
