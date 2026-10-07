import { useMemo } from 'react';

import { useBranchScope } from '../branches/BranchContext';
import { stationLabel } from './station';

/**
 * id → "PC-01 (MNR-PC-01)", for pages that only have machine ids (alerts,
 * sessions). From GET /machines, so it covers every station the user may see.
 */
export function useStationNames(): Map<string, string> {
  const { machines } = useBranchScope();
  return useMemo(
    () =>
      new Map(
        machines.map((m) => [m.id, m.name && m.name !== m.serialNumber ? `${stationLabel(m)} (${m.serialNumber})` : m.serialNumber]),
      ),
    [machines],
  );
}
