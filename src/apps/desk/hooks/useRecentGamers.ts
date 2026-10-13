import { useCallback, useState } from 'react';

import { addRecent, type WalletGamer } from '../../../domain/gamerSearch';

// Per-browser convenience: the desk remembers the gamers it opened a wallet for.
const STORAGE_KEY = 'barondesk.recentGamers';

function read(): WalletGamer[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (x): x is WalletGamer => typeof x === 'object' && x !== null && typeof x.gamerProfileId === 'string' && typeof x.username === 'string',
    );
  } catch {
    return [];
  }
}

/** The gamers this browser opened a wallet for, latest first; add() puts one on top. */
export function useRecentGamers() {
  const [gamers, setGamers] = useState<WalletGamer[]>(read);
  const add = useCallback((gamer: WalletGamer) => {
    setGamers((list) => {
      const next = addRecent(list, gamer);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage blocked: not remembered
      }
      return next;
    });
  }, []);
  return { gamers, add };
}
