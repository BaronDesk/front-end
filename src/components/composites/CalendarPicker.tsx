import { useState } from 'react';

import calendar from '../assets/calendar.svg';
import { ART, Art } from '../primitives/Art';
import { Pill } from '../primitives/Pill';
import { dayFromValue, localDateInput } from '../../lib/dates';
import { cx } from '../../lib/cx';
import styles from './CalendarPicker.module.css';
import dayStyles from './DayPicker.module.css';
import { usePopover } from './usePopover';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The days to draw for a month: whole weeks from Monday, the neighbours' days included. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // days of the previous month before the 1st (weeks start on Monday)
  const start = new Date(year, month, 1 - lead);
  const weeks = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/**
 * A month calendar in a panel: any day, the months paged with ‹ ›; today
 * ringed, the chosen day filled like a chosen seat, a "Today" shortcut. It
 * opens on the chosen day's month. `className` places the panel.
 */
export function CalendarPanel({ value, onPick, className }: { value: string; onPick(day: string): void; className?: string }) {
  const chosen = new Date(`${value}T00:00:00`);
  const [shown, setShown] = useState({ year: chosen.getFullYear(), month: chosen.getMonth() });
  const today = localDateInput(new Date());
  const page = (step: number) => setShown(({ year, month }) => ({ year: month + step < 0 ? year - 1 : month + step > 11 ? year + 1 : year, month: (month + step + 12) % 12 }));

  return (
    <div className={cx(styles.panel, className)} role="dialog" aria-label="Pick a day">
      <div className={styles.head}>
        <button type="button" className={styles.nav} aria-label="Previous month" onClick={() => page(-1)}>
          ‹
        </button>
        <span className={styles.month}>
          {MONTHS[shown.month]} {shown.year}
        </span>
        <button type="button" className={styles.nav} aria-label="Next month" onClick={() => page(1)}>
          ›
        </button>
      </div>
      <div className={styles.grid}>
        {WEEKDAYS.map((w) => (
          <span key={w} className={styles.weekday}>
            {w}
          </span>
        ))}
        {monthGrid(shown.year, shown.month).map((d) => {
          const v = localDateInput(d);
          return (
            <button
              key={v}
              type="button"
              className={cx(styles.day, d.getMonth() !== shown.month && styles.other, v === today && styles.today, v === value && styles.chosen)}
              aria-pressed={v === value}
              aria-label={d.toDateString()}
              onClick={() => onPick(v)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.todayButton} onClick={() => onPick(today)}>
        Today
      </button>
    </div>
  );
}

/** The day pill (as DayPicker) opening a month calendar under the pills. `className` places the pill. */
export function CalendarPicker({ value, onChange, className }: { value: string; onChange(day: string): void; className?: string }) {
  const { open, setOpen, box } = usePopover();
  return (
    <div ref={box}>
      <Pill className={className} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={dayStyles.calendar}>
          <Art src={calendar} w={ART.calendar[0]} h={ART.calendar[1]} />
        </span>
        <span>{dayFromValue(value)}</span>
      </Pill>
      {open && (
        <CalendarPanel
          className={styles.underPills}
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
