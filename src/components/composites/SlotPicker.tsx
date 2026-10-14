import alarm from '../assets/alarm.svg';
import { ART, Art } from '../primitives/Art';
import { BOOKING_DAYS_AHEAD, BOOKING_LENGTHS, bookableTimes, lengthShortText, UNTIL_BALANCE, type Slot } from '../../domain/bookings';
import { localDateInput } from '../../lib/dates';
import { CalendarPicker } from './CalendarPicker';
import { ChipPicker } from './ChipPicker';
import { DayPicker } from './DayPicker';

/**
 * The app's time slot pickers: the day, the start ("Now"
 * today, then every half hour) and the length, each a pill opening its chips.
 * Picking another day starts it at "Now" (today) or 18:00. `anyDay`: a month
 * calendar instead of the next 7 days; `anyTime`: today's past hours too (the
 * desk looks back; a gamer only books ahead). `untilBalance`: "Now" also
 * offers Max, play until the coins run out (another start time drops it).
 * `classNames` place the three pills.
 */
export function SlotPicker({
  value,
  onChange,
  anyDay = false,
  anyTime = false,
  untilBalance = false,
  classNames = {},
}: {
  value: Slot;
  onChange(slot: Slot): void;
  anyDay?: boolean;
  anyTime?: boolean;
  untilBalance?: boolean;
  classNames?: { day?: string; time?: string; length?: string };
}) {
  const today = localDateInput(new Date());
  const isNow = value.time === 'now';
  const lengths = untilBalance && isNow ? [...BOOKING_LENGTHS, UNTIL_BALANCE] : BOOKING_LENGTHS;
  // Max is a Play now length only: a start time later on gets an hour instead.
  const change = (next: Slot) => onChange(next.time !== 'now' && next.minutes === UNTIL_BALANCE ? { ...next, minutes: 60 } : next);
  const pickDay = (day: string) => change({ ...value, day, time: day === today ? 'now' : '18:00' });
  return (
    <>
      {anyDay ? (
        <CalendarPicker className={classNames.day} value={value.day} onChange={pickDay} />
      ) : (
        <DayPicker className={classNames.day} value={value.day} daysAhead={BOOKING_DAYS_AHEAD} onChange={pickDay} />
      )}
      <ChipPicker
        className={classNames.time}
        name="Pick a time"
        columns={6}
        value={value.time}
        choices={[...(value.day === today ? [{ value: 'now', label: 'Now' }] : []), ...bookableTimes(value.day, new Date(), anyTime).map((t) => ({ value: t, label: t }))]}
        onChange={(time) => change({ ...value, time })}
      >
        <Art src={alarm} w={ART.alarm[0]} h={ART.alarm[1]} />
        <span>{isNow ? 'Now' : value.time}</span>
      </ChipPicker>
      <ChipPicker
        className={classNames.length}
        name="Pick how long"
        columns={lengths.length}
        value={value.minutes}
        choices={lengths.map((m) => ({ value: m, label: lengthShortText(m) }))}
        onChange={(minutes) => onChange({ ...value, minutes })}
      >
        <span>{lengthShortText(value.minutes)}</span>
      </ChipPicker>
    </>
  );
}
