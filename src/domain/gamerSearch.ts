import type { PublicUser } from '../core/api-types';

/** A gamer whose wallet the desk opened: the profile id keys every wallet route. */
export interface WalletGamer {
  gamerProfileId: string;
  username: string;
}

/** How many recent gamers the desk remembers. */
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
