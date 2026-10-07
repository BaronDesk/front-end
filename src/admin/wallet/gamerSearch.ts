import { useCallback, useState } from 'react';

import type { PublicUser } from '../../api/types';

/** A gamer whose wallet the desk opened: the profile id keys every wallet route. */
export interface WalletGamer {
  gamerProfileId: string;
  username: string;
}

// Per-browser convenience: the desk remembers the gamers it opened a wallet for.
const STORAGE_KEY = 'barondesk.recentGamers';
const MAX = 10;

/** `gamer` first, without a duplicate, at most `max` long. */
export function addRecent(list: WalletGamer[], gamer: WalletGamer, max = MAX): WalletGamer[] {
  return [gamer, ...list.filter((g) => g.gamerProfileId !== gamer.gamerProfileId)].slice(0, max);
}

/** GET /gamers?q= results the desk can open (gamers with a profile). */
export function toWalletGamers(users: PublicUser[]): WalletGamer[] {
  return users.flatMap((u) => (u.gamerProfileId ? [{ gamerProfileId: u.gamerProfileId, username: u.username }] : []));
}

/** The one gamer whose username is exactly `q` (any case), else null: the desk then picks from the list. */
export function exactMatch(gamers: WalletGamer[], q: string): WalletGamer | null {
  const wanted = q.trim().toLowerCase();
  return gamers.find((g) => g.username.toLowerCase() === wanted) ?? null;
}

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
