import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

import selectArrow from '../assets/select-arrow.svg';
import { usePopover } from '../composites/usePopover';
import { cx } from '../../lib/cx';
import { ART, Art } from './Art';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
  /** Shown (faded) while no option is chosen. */
  placeholder?: string;
  /** `compact`: an inline control (the desk's filters and forms); `field`: the phone's rounded cream field. */
  look?: 'compact' | 'field';
  id?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

/**
 * A dropdown in the design's style: a field-like button that opens a list of
 * options, the chosen one filled brown (like a chosen chip). Keyboard: Enter,
 * Space or the arrows open it; the arrows, Home and End move; Enter or Space
 * picks; Esc or a tap outside closes. `required` blocks the form's submit
 * while nothing is chosen, as a native select would.
 */
export function Select({ value, options, onChange, placeholder = '', look = 'compact', id, required, disabled, className, ...rest }: SelectProps) {
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(-1);
  // The list is placed against the window, so a table or card that clips its content never cuts it.
  const [place, setPlace] = useState<CSSProperties>({});
  const chosen = options.findIndex((o) => o.value === value);

  const { open, setOpen, box } = usePopover(() => {
    const r = box.current?.getBoundingClientRect();
    if (r) {
      const below = window.innerHeight - r.bottom;
      // Under the button, or above it when the window has little room below.
      // No wider than the room left in the window (long options end in …).
      const width = { left: r.left, minWidth: r.width, maxWidth: `min(calc(360 * var(--u)), ${Math.max(window.innerWidth - r.left - 8, r.width)}px)` };
      setPlace(below < 220 && r.top > below ? { ...width, bottom: window.innerHeight - r.top + 4 } : { ...width, top: r.bottom + 4 });
    }
    const start = chosen >= 0 ? chosen : options.findIndex((o) => !o.disabled);
    setActive(start);
    list.current?.focus();
    const row = list.current?.children[start] as HTMLElement | undefined;
    if (list.current && row) list.current.scrollTop = row.offsetTop - list.current.clientHeight / 2 + row.offsetHeight / 2;
  });

  // Scrolling or resizing would leave the list behind: close it instead.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => !list.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    return () => {
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', away);
    };
  }, [open, setOpen]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const pick = (o: SelectOption) => {
    if (o.disabled) return;
    onChange(o.value);
    close();
  };
  /** The next option that can be picked, from `from` in direction `step`. */
  const move = (from: number, step: number) => {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i;
    return from;
  };

  function onButtonKey(e: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKey(e: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => move(a, 1)),
      ArrowUp: () => setActive((a) => move(a, -1)),
      Home: () => setActive(move(-1, 1)),
      End: () => setActive(move(options.length, -1)),
      Enter: () => options[active] && pick(options[active]),
      ' ': () => options[active] && pick(options[active]),
      Escape: close,
      Tab: () => setOpen(false),
    };
    const handle = keys[e.key];
    if (!handle) return;
    if (e.key !== 'Tab') e.preventDefault();
    handle();
  }

  const label = chosen >= 0 ? options[chosen].label : placeholder;
  const listId = id ? `${id}-list` : undefined;

  return (
    <div ref={box} className={cx(styles.root, styles[look], className)}>
      <button
        ref={button}
        id={id}
        type="button"
        className={cx(styles.button, chosen < 0 && styles.empty)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={rest['aria-label']}
        onClick={() => setOpen(!open)}
        onKeyDown={onButtonKey}
      >
        <span className={styles.label}>{label}</span>
        <Art className={styles.arrow} src={selectArrow} w={ART.selectArrow[0]} h={ART.selectArrow[1]} />
      </button>
      {/* Keeps a required, empty choice from submitting the form (the browser says why). */}
      {required && <input className={styles.native} tabIndex={-1} aria-hidden="true" required value={value} onChange={() => undefined} onFocus={() => button.current?.focus()} />}
      {open && (
        <ul
          ref={list}
          id={listId}
          className={styles.panel}
          style={place}
          role="listbox"
          tabIndex={-1}
          aria-label={rest['aria-label']}
          aria-activedescendant={id && active >= 0 ? `${id}-${active}` : undefined}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={id ? `${id}-${i}` : undefined}
              role="option"
              aria-selected={i === chosen}
              aria-disabled={o.disabled || undefined}
              className={cx(styles.option, i === active && styles.active, i === chosen && styles.chosen, o.disabled && styles.disabled)}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onClick={() => pick(o)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
