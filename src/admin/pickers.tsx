import type { Station } from '../api/types';
import { stationLabel } from './stations/station';
import { useStationList } from './stations/useStationList';

interface StationSelectProps {
  id?: string;
  value: string;
  onChange(value: string): void;
  required?: boolean;
  /** Only list stations this returns true for (e.g. online ones). */
  filter?(s: Station): boolean;
}

/**
 * Plain <select> of the enrolled stations in the branch picked in the top
 * bar. The serial number follows the name: two branches can both have a PC-01.
 */
export function StationSelect({ id, value, onChange, required, filter }: StationSelectProps) {
  const { data, loading } = useStationList();
  const stations = [...(data ?? [])]
    .filter((s) => !filter || filter(s))
    .sort((a, b) => stationLabel(a).localeCompare(stationLabel(b)) || a.serialNumber.localeCompare(b.serialNumber));
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{loading ? 'loading…' : '— choose a station —'}</option>
      {stations.map((s) => (
        <option key={s.id} value={s.id}>
          {stationLabel(s)}
          {s.name && s.name !== s.serialNumber ? ` (${s.serialNumber})` : ''}
        </option>
      ))}
    </select>
  );
}
