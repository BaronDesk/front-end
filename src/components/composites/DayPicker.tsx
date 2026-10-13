import calendar from '../assets/calendar.svg';
import { ART, Art } from '../primitives/Art';
import { dayFromValue, localDateInput } from '../../lib/dates';
import { ChipPicker } from './ChipPicker';
import styles from './DayPicker.module.css';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The day pill of the Reserve panel and its picker: the days that can be
 * booked (today and the next `daysAhead`) as chips. `className` places the pill.
 */
export function DayPicker({ value, daysAhead, onChange, className }: { value: string; daysAhead: number; onChange(day: string): void; className?: string }) {
  const today = new Date();
  const days = Array.from({ length: daysAhead + 1 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  const choices = days.map((d) => ({
    value: localDateInput(d),
    title: d.toDateString(),
    label: (
      <>
        <span className={styles.week}>{localDateInput(d) === localDateInput(today) ? 'Today' : WEEKDAY[d.getDay()]}</span>
        <span className={styles.number}>{d.getDate()}</span>
        <span className={styles.month}>{MONTH[d.getMonth()]}</span>
      </>
    ),
  }));

  return (
    <ChipPicker className={className} name="Pick a day" columns={7} value={value} choices={choices} onChange={onChange}>
      <span className={styles.calendar}>
        <Art src={calendar} w={ART.calendar[0]} h={ART.calendar[1]} />
      </span>
      <span>{dayFromValue(value)}</span>
    </ChipPicker>
  );
}
