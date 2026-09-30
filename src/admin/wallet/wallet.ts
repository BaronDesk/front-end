import { useCallback, useState } from 'react';

// Per-browser convenience: member codes are long, so the desk remembers the
// ones that opened a wallet here.
const STORAGE_KEY = 'barondesk.memberCodes';
const MAX = 10;

function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function useRecentMemberCodes() {
  const [codes, setCodes] = useState<string[]>(read);
  const add = useCallback((code: string) => {
    setCodes((list) => {
      if (list.includes(code)) return list;
      const next = [code, ...list].slice(0, MAX);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage blocked: not remembered
      }
      return next;
    });
  }, []);
  return { codes, add };
}
