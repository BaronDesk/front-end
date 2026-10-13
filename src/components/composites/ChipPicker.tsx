import { useRef, type ReactNode } from 'react';

import { Pill } from '../primitives/Pill';
import { cx } from '../../lib/cx';
import styles from './ChipPicker.module.css';
import { usePopover } from './usePopover';

export interface Choice<T> {
  value: T;
  label: ReactNode;
  /** Read by screen readers when the label alone is not enough (e.g. a full date). */
  title?: string;
}

/**
 * A Pill that opens a panel of chips (the Reserve panel's day, time and
 * length): a tap picks one and closes the panel; the chosen one is filled,
 * like a chosen seat. A tap outside or Esc closes it. `children` is the
 * pill's content; `className` places the pill. The panel opens under the
 * pills, across their row.
 */
export function ChipPicker<T extends string | number>({
  value,
  choices,
  onChange,
  columns,
  name,
  className,
  children,
}: {
  value: T;
  choices: Choice<T>[];
  onChange(value: T): void;
  columns: number;
  /** The panel's name for screen readers ("Pick a day"). */
  name: string;
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const { open, setOpen, box } = usePopover(() => {
    // A long list scrolls: the chosen chip is in view when it opens.
    const chosen = panel.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (panel.current && chosen) panel.current.scrollTop = chosen.offsetTop - panel.current.clientHeight / 2 + chosen.offsetHeight / 2;
  });

  return (
    <div ref={box}>
      <Pill className={className} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        {children}
      </Pill>
      {open && (
        <div ref={panel} className={styles.panel} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }} role="dialog" aria-label={name}>
          {choices.map((c) => (
            <button
              key={c.value}
              type="button"
              className={c.value === value ? cx(styles.chip, styles.chosen) : styles.chip}
              aria-pressed={c.value === value}
              aria-label={c.title}
              onClick={() => {
                onChange(c.value);
                setOpen(false);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
