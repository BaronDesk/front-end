import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import type { Branch } from '../api/types';
import { useApiQuery } from '../shared/useApiQuery';

// Per-tab convenience: the portal remembers the last venue picked.
const STORAGE_KEY = 'barondesk.portalBranch';

function readStored(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeStored(id: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage blocked: the choice just isn't remembered
  }
}

export function useBranches(): Branch[] {
  const { data } = useApiQuery<Branch[]>('/branches');
  return data ?? [];
}

/**
 * The venue the gamer is looking at: ?branch= in the URL (from a "Book »"
 * link), else the last one picked, else the first branch.
 */
export function useBranchChoice(): [string, (id: string) => void] {
  const branches = useBranches();
  const [params] = useSearchParams();
  const [branchId, setBranchIdState] = useState(() => params.get('branch') ?? readStored());

  useEffect(() => {
    if (branches.length && !branches.some((b) => b.id === branchId)) setBranchIdState(branches[0].id);
  }, [branches, branchId]);

  function setBranchId(id: string) {
    setBranchIdState(id);
    writeStored(id);
  }
  return [branchId, setBranchId];
}

export function BranchSelect({ id, value, onChange }: { id?: string; value: string; onChange(id: string): void }) {
  const branches = useBranches();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {!branches.length && <option value="">loading…</option>}
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
