import { useEffect, useState } from 'react';

import { api } from '../api/http';
import type { Branch, PublicUser } from '../api/types';

/**
 * Display name of the user's branch. GET /branches isn't on the real
 * backend yet, so this falls back to the start of the id.
 */
export function useBranchName(user: PublicUser | null): string {
  const branchId = user?.branchId ?? null;
  // undefined = loading, null = lookup failed
  const [name, setName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    api<Branch[]>('GET', '/branches')
      .then((branches) => {
        // The mock maps a branch it doesn't know onto its first one.
        const branch = branches.find((b) => b.id === branchId) ?? (branches.length === 1 ? branches[0] : null);
        if (!cancelled) setName(branch?.name ?? null);
      })
      .catch(() => !cancelled && setName(null));
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  if (!user) return '—';
  if (!branchId) return 'All branches';
  if (name === undefined) return '…';
  return name ?? branchId.slice(0, 8);
}
