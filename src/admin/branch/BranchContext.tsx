import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Branch } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApiQuery } from '../../shared/useApiQuery';

/**
 * Which branch the admin app works on (Multi-Agency, brief §6.12).
 * Staff and branch admins are fixed to their own branch; the server scopes
 * their calls from the JWT. HQ (branchId = null) picks "All branches" or one
 * branch in the top bar; lists then ask for ?branchId= and live events from
 * other branches are ignored, so actions run on the selected branch.
 */
interface BranchScope {
  isHq: boolean;
  branches: Branch[];
  /** Branch that lists and actions cover. null = all branches (HQ only). */
  branchId: string | null;
  /** HQ only; ignored for everyone else. */
  setBranchId(id: string | null): void;
  branchName(id: string | null): string;
  /** `path` with ?branchId= added when HQ has picked one branch. */
  scoped(path: string): string;
  /** Should a live event from this branch reach the current screen? null (a deleted branch) only for "All branches". */
  inScope(branchId: string | null): boolean;
}

const BranchContext = createContext<BranchScope | null>(null);

// Per-tab convenience only: a reload keeps HQ on the branch it was looking at.
const STORAGE_KEY = 'barondesk.hqBranch';

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the choice just doesn't survive a reload
  }
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isHq = user?.branchId === null;
  // GET /branches isn't on the real backend yet: names then fall back to the id.
  const { data } = useApiQuery<Branch[]>(user ? '/branches' : null);
  const branches = useMemo(() => data ?? [], [data]);
  const [picked, setPicked] = useState<string | null>(() => (isHq ? readStored() : null));

  // A stored branch that no longer exists (or another server's) means "all".
  useEffect(() => {
    if (picked && data && !data.some((b) => b.id === picked)) {
      setPicked(null);
      writeStored(null);
    }
  }, [picked, data]);

  const branchId = isHq ? picked : (user?.branchId ?? null);

  const setBranchId = useCallback(
    (id: string | null) => {
      if (!isHq) return;
      setPicked(id);
      writeStored(id);
    },
    [isHq],
  );

  const branchName = useCallback(
    (id: string | null) => {
      if (!id) return 'All branches';
      // The mock maps a branch it doesn't know onto its first one.
      const branch = branches.find((b) => b.id === id) ?? (!isHq && branches.length === 1 ? branches[0] : undefined);
      return branch?.name ?? id.slice(0, 8);
    },
    [branches, isHq],
  );

  const scoped = useCallback(
    (path: string) => {
      if (!isHq || !branchId) return path;
      return `${path}${path.includes('?') ? '&' : '?'}branchId=${encodeURIComponent(branchId)}`;
    },
    [isHq, branchId],
  );

  // Staff only receive their own branch's room, so everything is in scope.
  const inScope = useCallback((id: string | null) => !isHq || !branchId || id === branchId, [isHq, branchId]);

  const value = useMemo(
    () => ({ isHq, branches, branchId, setBranchId, branchName, scoped, inScope }),
    [isHq, branches, branchId, setBranchId, branchName, scoped, inScope],
  );
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranchScope(): BranchScope {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranchScope must be used inside <BranchProvider>');
  return ctx;
}

/** Top-bar branch: a dropdown for HQ, plain text for everyone else. */
export function BranchSwitcher() {
  const { isHq, branches, branchId, setBranchId, branchName } = useBranchScope();
  if (!isHq) {
    return (
      <>
        Branch: <b>{branchName(branchId)}</b>
      </>
    );
  }
  return (
    <>
      <label htmlFor="branch-switch">Branch:</label>{' '}
      <select id="branch-switch" value={branchId ?? ''} onChange={(e) => setBranchId(e.target.value || null)}>
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </>
  );
}
