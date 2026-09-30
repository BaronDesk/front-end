import { useMemo } from 'react';

import type { Station } from '../../api/types';
import { useApiQuery, type ApiQuery } from '../../shared/useApiQuery';
import { useBranchScope } from '../branch/BranchContext';
import { STATIONS_PATH } from './station';

/**
 * GET /api/v1/stations joined with GET /machines. The station list has no
 * branch and also returns PCs that are still waiting for approval or were
 * rejected, and it ignores ?branchId=; the machines list has both. Returns
 * enrolled PCs only, each with its branchId, limited to the branch picked in
 * the top bar. `setData` patches the raw list (live station_status).
 */
export function useStationList(): ApiQuery<Station[]> {
  const { machines, branchId } = useBranchScope();
  const query = useApiQuery<Station[]>(STATIONS_PATH);
  const raw = query.data;

  const data = useMemo(() => {
    if (!raw) return undefined;
    const byId = new Map(machines.map((m) => [m.id, m]));
    return raw.flatMap((s) => {
      const machine = byId.get(s.id);
      if (!machine || machine.enrollmentStatus !== 'ENROLLED') return [];
      if (branchId && machine.branchId !== branchId) return [];
      return [{ ...s, branchId: machine.branchId }];
    });
  }, [raw, machines, branchId]);

  return { ...query, data };
}
