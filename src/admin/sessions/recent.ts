import { useCallback, useState } from 'react';

// Per-browser convenience: the backend has no session list, so the desk
// remembers the sessions it saw running to find their bills later. Ids only.
const STORAGE_KEY = 'barondesk.recentSessions';
const MAX = 15;

function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // storage blocked: the list just isn't kept
  }
}

export function useRecentSessions() {
  const [ids, setIds] = useState<string[]>(read);
  const add = useCallback((id: string) => {
    setIds((list) => {
      const next = [id, ...list.filter((x) => x !== id)].slice(0, MAX);
      write(next);
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    write([]);
    setIds([]);
  }, []);
  return { ids, add, clear };
}
