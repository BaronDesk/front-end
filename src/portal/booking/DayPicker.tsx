import { useEffect, useRef, useState } from 'react';

import calendar from '../ui/assets/calendar.svg';
import { ART, Art } from '../ui/units';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');
/** "2026-10-14": the value the booking page keeps. */
export const dayValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * The day pill of the Reserve panel and its picker: a tap opens the days that
 * can be booked (today and the next `daysAhead`) as chips in the design's
 * style; the chosen one is filled, like a chosen seat. A tap outside or Esc closes it.
 */
export function DayPicker({ value, daysAhead, onChange }: { value: string; daysAhead: number; onChange(day: string): void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const today = new Date();
  const days = Array.from({ length: daysAhead + 1 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));

  return (
    <div ref={box} className="bd-daypicker">
      <button type="button" className="bd-pill bd-pill-date" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="bd-pill-calendar">
          <Art src={calendar} w={ART.calendar[0]} h={ART.calendar[1]} />
        </span>
        <span>{value.split('-').reverse().join('/')}</span>
      </button>
      {open && (
        <div className="bd-days" role="dialog" aria-label="Pick a day">
          {days.map((d) => {
            const v = dayValue(d);
            return (
              <button
                key={v}
                type="button"
                className={v === value ? 'bd-day bd-day-chosen' : 'bd-day'}
                aria-pressed={v === value}
                aria-label={d.toDateString()}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
              >
                <span className="bd-day-week">{v === dayValue(today) ? 'Today' : WEEKDAY[d.getDay()]}</span>
                <span className="bd-day-number">{d.getDate()}</span>
                <span className="bd-day-month">{MONTH[d.getMonth()]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
