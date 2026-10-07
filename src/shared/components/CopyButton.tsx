import { useState } from 'react';

/** "Copy" next to a code the user must pass on (PIN, booking link). */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // No clipboard (plain http on a phone): let the user copy by hand.
      window.prompt('Copy this:', text);
    }
  }

  return (
    <button type="button" className="secondary" onClick={copy}>
      {done ? 'Copied' : label}
    </button>
  );
}
