import { useEffect, useRef, useState } from 'react';

/**
 * A pill's panel (ChipPicker, CalendarPicker): open / closed, closed by a tap
 * outside the box or by Esc. `onOpen` runs each time it opens (e.g. to scroll
 * the chosen chip into view).
 */
export function usePopover(onOpen?: () => void) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const opened = useRef(onOpen);
  opened.current = onOpen;

  useEffect(() => {
    if (!open) return;
    opened.current?.();
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return { open, setOpen, box };
}
