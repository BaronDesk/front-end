import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Branch, Machine } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useOnReconnect } from '../../realtime/RealtimeContext';
import { useApiQuery } from '../../shared/useApiQuery';
import { deriveBranches, shortId } from './branches';

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
  /**
   * Every PC the user may see (GET /machines, all branches for HQ): the
   * source of branch ids and labels, and of each station's branch.
   */
  machines: Machine[];
  reloadMachines(): void;
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
  // No GET /branches on the backend: branches come from the PCs the user can see.
  const machineQuery = useApiQuery<Machine[]>(user ? '/machines' : null);
  const data = machineQuery.data;
  const machines = useMemo(() => data ?? [], [data]);
  const branches = useMemo(() => deriveBranches(machines, [user?.branchId]), [machines, user?.branchId]);
  const reloadMachines = machineQuery.reload;
  useOnReconnect(reloadMachines);
  const [picked, setPicked] = useState<string | null>(() => (isHq ? readStored() : null));

  // A stored branch that no longer exists (or another server's) means "all".
  useEffect(() => {
    if (picked && data && !branches.some((b) => b.id === picked)) {
      setPicked(null);
      writeStored(null);
    }
  }, [picked, data, branches]);

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
      return branches.find((b) => b.id === id)?.name ?? shortId(id);
    },
    [branches],
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
    () => ({ isHq, branches, machines, reloadMachines, branchId, setBranchId, branchName, scoped, inScope }),
    [isHq, branches, machines, reloadMachines, branchId, setBranchId, branchName, scoped, inScope],
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
