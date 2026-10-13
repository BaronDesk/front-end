import { Select } from '../primitives/Select';

/** Every quarter of an hour: "00:00", "00:15" … "23:45". */
const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);

/**
 * A time of day (HH:MM) as a Select of quarter hours. A value off that grid
 * (saved before) is kept in the list, so it shows and stays as it is.
 */
export function TimeField({ value, onChange, className, ...rest }: { value: string; onChange(time: string): void; className?: string; 'aria-label'?: string; id?: string }) {
  const times = TIMES.includes(value) || !value ? TIMES : [...TIMES, value].sort();
  return <Select className={className} value={value} onChange={onChange} options={times.map((t) => ({ value: t, label: t }))} aria-label={rest['aria-label']} id={rest.id} />;
}
