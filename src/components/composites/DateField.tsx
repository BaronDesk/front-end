import calendar from '../assets/calendar.svg';
import { ART, Art } from '../primitives/Art';
import selectStyles from '../primitives/Select.module.css';
import { dayFromValue } from '../../lib/dates';
import { cx } from '../../lib/cx';
import { CalendarPanel } from './CalendarPicker';
import calendarStyles from './CalendarPicker.module.css';
import dayStyles from './DayPicker.module.css';
import { usePopover } from './usePopover';

/**
 * A date (yyyy-mm-dd) in a field like Select's: a tap opens the month
 * calendar under it, any day. `id` lets a <label> point at it.
 */
export function DateField({ value, onChange, id, className, ...rest }: { value: string; onChange(day: string): void; id?: string; className?: string; 'aria-label'?: string }) {
  const { open, setOpen, box } = usePopover();
  return (
    <div ref={box} className={cx(selectStyles.root, selectStyles.compact, className)}>
      <button id={id} type="button" className={selectStyles.button} aria-haspopup="dialog" aria-expanded={open} aria-label={rest['aria-label']} onClick={() => setOpen(!open)}>
        <span className={dayStyles.calendar}>
          <Art src={calendar} w={ART.calendar[0]} h={ART.calendar[1]} />
        </span>
        <span className={selectStyles.label}>{dayFromValue(value)}</span>
      </button>
      {open && (
        <CalendarPanel
          className={calendarStyles.underField}
          value={value}
          onPick={(day) => {
            onChange(day);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
