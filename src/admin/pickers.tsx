import type { PublicUser, Station } from '../api/types';
import { useApiQuery } from '../shared/useApiQuery';

interface PickerProps {
  id?: string;
  value: string;
  onChange(value: string): void;
  required?: boolean;
}

/** Plain <select> of gamers, sorted by username. Fine for a venue-sized list. */
export function GamerSelect({ id, value, onChange, required }: PickerProps) {
  const { data, loading } = useApiQuery<PublicUser[]>('/users?role=GAMER');
  const gamers = [...(data ?? [])].filter((u) => u.accountStatus === 'ACTIVE').sort((a, b) => a.username.localeCompare(b.username));
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{loading ? 'loading…' : '— choose a gamer —'}</option>
      {gamers.map((u) => (
        <option key={u.id} value={u.id}>
          {u.username}
        </option>
      ))}
    </select>
  );
}

interface StationSelectProps extends PickerProps {
  /** Only list stations this returns true for (e.g. free ones). */
  filter?(s: Station): boolean;
  /** Text after the name, e.g. "(busy)". */
  note?(s: Station): string;
}

export function StationSelect({ id, value, onChange, required, filter, note }: StationSelectProps) {
  const { data, loading } = useApiQuery<Station[]>('/stations');
  const stations = [...(data ?? [])].filter((s) => !filter || filter(s)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{loading ? 'loading…' : '— choose a station —'}</option>
      {stations.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {note ? ` ${note(s)}` : ''}
        </option>
      ))}
    </select>
  );
}
