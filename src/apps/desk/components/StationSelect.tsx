import type { Station } from '../../../core/api-types';
import { stationLabel } from '../../../domain/stations';
import { useStationList } from '../hooks/useStationList';
import { Select } from '../../../components/primitives/Select';

interface StationSelectProps {
  id?: string;
  value: string;
  onChange(value: string): void;
  required?: boolean;
  /** Only list stations this returns true for (e.g. online ones). */
  filter?(s: Station): boolean;
}

/**
 * A Select of the enrolled stations in the branch picked in the header. The serial number follows the name: two branches can both have a PC-01.
 */
export function StationSelect({ id, value, onChange, required, filter }: StationSelectProps) {
  const { data, loading } = useStationList();
  const stations = [...(data ?? [])]
    .filter((s) => !filter || filter(s))
    .sort((a, b) => stationLabel(a).localeCompare(stationLabel(b)) || a.serialNumber.localeCompare(b.serialNumber));
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      required={required}
      placeholder={loading ? 'loading…' : '— choose a station —'}
      options={stations.map((s) => ({ value: s.id, label: `${stationLabel(s)}${s.name && s.name !== s.serialNumber ? ` (${s.serialNumber})` : ''}` }))}
    />
  );
}
