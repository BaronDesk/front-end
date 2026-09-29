import { useMemo } from 'react';

import type { PublicUser, Station } from '../api/types';
import { useApiQuery } from '../shared/useApiQuery';
import { stationLabel, STATIONS_PATH } from './stations/station';

/** id → username for gamers, to show "who is playing". */
export function useGamerNames(): Map<string, string> {
  const { data } = useApiQuery<PublicUser[]>('/users?role=GAMER');
  return useMemo(() => new Map((data ?? []).map((u) => [u.id, u.username])), [data]);
}

/** id → station name, for pages that only have machine ids (alerts). */
export function useStationNames(): Map<string, string> {
  const { data } = useApiQuery<Station[]>(STATIONS_PATH);
  return useMemo(() => new Map((data ?? []).map((s) => [s.id, stationLabel(s)])), [data]);
}
