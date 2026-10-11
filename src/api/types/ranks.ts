/** Gamer ranks (Wood → GrandMaster), editable by branch admins and HQ. */

/**
 * GET /ranks (anyone logged in, lowest XP first), POST / PATCH / DELETE
 * /ranks/:id (manager+). A gamer holds the highest rank whose minXp is at or
 * below their XP.
 */
export interface Rank {
  id: string;
  name: string;
  minXp: number;
  /** /uploads/images/<id>.webp, or null. */
  badgeUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What a user carries of a rank (PublicUser.rank / nextRank). */
export type RankRef = Pick<Rank, 'id' | 'name' | 'minXp' | 'badgeUrl'>;

export interface RankInput {
  name: string;
  minXp: number;
  /** A link from uploadImage(); null removes the badge. */
  badgeUrl?: string | null;
}
