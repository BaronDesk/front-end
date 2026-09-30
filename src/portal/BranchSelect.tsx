import type { Branch } from '../api/types';

/** A branch picker for gamers: name and location. */
export function BranchSelect({
  id,
  branches,
  value,
  onChange,
}: {
  id: string;
  branches: Branch[] | undefined;
  value: string;
  onChange(branchId: string): void;
}) {
  return (
    <select id={id} required value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{branches ? '— choose your branch —' : 'Loading…'}</option>
      {(branches ?? []).map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
          {b.location ? ` — ${b.location}` : ''}
        </option>
      ))}
    </select>
  );
}
