import type { PublicUser } from '../core/api-types';

/** How far the gamer is from their rank to the next one, 0..1 (full at the top rank). */
export function xpProgress(user: Pick<PublicUser, 'xp' | 'rank' | 'nextRank'>): number {
  if (!user.nextRank) return 1;
  const from = user.rank?.minXp ?? 0;
  const span = user.nextRank.minXp - from;
  return span > 0 ? Math.min(Math.max(((user.xp ?? 0) - from) / span, 0), 1) : 0;
}
