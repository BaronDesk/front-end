import type { Branch, Machine } from '../../api/types';

/**
 * Fallback only, while GET /branches hasn't answered: the branches a user can
 * see, built from GET /machines. A branch is labelled by the prefix its PCs'
 * serial numbers share (MNR-PC-01…05 → "MNR"), else by a short id.
 * `extraIds` adds branches with no PC yet (e.g. the user's own branch).
 */
export function deriveBranches(machines: Machine[], extraIds: (string | null | undefined)[] = []): Branch[] {
  const serialsByBranch = new Map<string, string[]>();
  for (const m of machines) {
    const list = serialsByBranch.get(m.branchId) ?? [];
    list.push(m.serialNumber);
    serialsByBranch.set(m.branchId, list);
  }
  for (const id of extraIds) {
    if (id && !serialsByBranch.has(id)) serialsByBranch.set(id, []);
  }
  return [...serialsByBranch]
    .map(([id, serials]) => ({ id, name: branchLabel(id, serials) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function shortId(id: string): string {
  return `Branch ${id.slice(0, 8)}`;
}

function branchLabel(id: string, serials: string[]): string {
  const prefixes = new Set(serials.map((s) => s.split(/[-_ ]/)[0]).filter(Boolean));
  return prefixes.size === 1 ? `${[...prefixes][0]} branch` : shortId(id);
}
