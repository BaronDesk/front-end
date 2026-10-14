import type { Tournament, TournamentFormat, TournamentMatch, TournamentStatus, TournamentTeam } from '../core/api-types';

export const STATUS_TEXT: Record<TournamentStatus, string> = {
  REGISTRATION_OPEN: 'Open',
  REGISTRATION_CLOSED: 'Upcoming',
  IN_PROGRESS: 'Live',
  COMPLETED: 'Finished',
  CANCELLED: 'Cancelled',
};

/** The list's filter chips, in order, and the statuses each one shows. */
export const TOURNAMENT_FILTERS: { key: string; label: string; statuses: TournamentStatus[] | null }[] = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'open', label: 'Open', statuses: ['REGISTRATION_OPEN'] },
  { key: 'upcoming', label: 'Upcoming', statuses: ['REGISTRATION_CLOSED'] },
  { key: 'live', label: 'Live', statuses: ['IN_PROGRESS'] },
  { key: 'finished', label: 'Finished', statuses: ['COMPLETED', 'CANCELLED'] },
];

export function filterTournaments(list: Tournament[], key: string): Tournament[] {
  const statuses = TOURNAMENT_FILTERS.find((f) => f.key === key)?.statuses;
  return statuses ? list.filter((t) => statuses.includes(t.status)) : list;
}

// ---------- A card's words ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

export function formatName(format: TournamentFormat): string {
  return format === 'ROUND_ROBIN' ? 'Round Robin' : 'Single Elimination';
}

/** "5/Team"; solo play: "Solo". */
export function teamSizeText(teamSize: number): string {
  return teamSize === 1 ? 'Solo' : `${teamSize}/Team`;
}

/** A branch on a tag: "CENTRE El Manar" → "El-Manar". */
export function branchTag(name: string): string {
  return name.replace(/^CENTRE\s+/i, '').trim().replace(/\s+/g, '-');
}

/** When a tournament starts, on its card: "Oct 14-2026-18:00" (local time). */
export function cardDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}-${d.getFullYear()}-${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** When a match is, on the next-match card: "14 Oct - 16:30". */
export function matchDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Where the tournament stands, right of its date: "Starts in 3 Days !", "Live now !", "Finished". */
export function startsInText(t: Pick<Tournament, 'status' | 'startsAt'>, now = new Date()): string {
  if (t.status === 'IN_PROGRESS') return 'Live now !';
  if (t.status === 'COMPLETED') return 'Finished';
  if (t.status === 'CANCELLED') return 'Cancelled';
  const start = new Date(t.startsAt);
  const days = Math.round((new Date(start).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return 'Starts today !';
  if (days === 1) return 'Starts tomorrow !';
  return `Starts in ${days} Days !`;
}

/** The card's button (to the tournament), worded for where it stands and whether the gamer is in it. */
export function cardAction(t: Pick<Tournament, 'status' | 'myTeamId'>): string {
  if (t.status === 'COMPLETED') return 'View Results';
  if (t.status === 'CANCELLED') return 'View Tournament';
  if (t.myTeamId) return 'My Team';
  if (t.status === 'REGISTRATION_OPEN') return 'Join Tournament';
  if (t.status === 'IN_PROGRESS') return 'Follow Live';
  return 'View Tournament';
}

/** The cover to show: the uploaded one, else the game's poster (null: neither). */
export function coverOf(t: Pick<Tournament, 'coverUrl' | 'game'>): string | null {
  return t.coverUrl ?? t.game.iconUrl;
}

// ---------- Teams ----------

export function teamOf(t: Pick<Tournament, 'teams'>, id: string | null): TournamentTeam | null {
  return t.teams.find((team) => team.id === id) ?? null;
}

/**
 * A team's cells, one per player place: the members in the middle ones, the
 * captain (first member) in the center of them, the free places around (null).
 */
export function teamCells(teamSize: number, members: string[]): (string | null)[] {
  const shown = members.slice(0, teamSize);
  if (shown.length === 0) return Array(teamSize).fill(null);
  const [captain, ...others] = shown;
  const mid = Math.floor(shown.length / 2);
  const block = [...others.slice(0, mid), captain, ...others.slice(mid)];
  const start = Math.floor((teamSize - block.length) / 2);
  return Array.from({ length: teamSize }, (_, i) => block[i - start] ?? null);
}

// ---------- Bracket ----------

/** How many rounds the bracket has: from its matches, else from the places (8 teams → 3). */
export function roundCount(t: Pick<Tournament, 'matches' | 'maxTeams'>): number {
  const drawn = Math.max(0, ...t.matches.map((m) => m.round));
  return drawn || Math.max(1, Math.ceil(Math.log2(Math.max(t.maxTeams, 2))));
}

/** "Final", "Semi-finals", "Quarter-finals", else "Round 1". */
export function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-finals';
  if (fromEnd === 2) return 'Quarter-finals';
  return `Round ${round}`;
}

/** One match's round, as the next-match card says it: "Final", "Semi Final", "Quarter Final", "Round 1". */
export function matchRoundName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi Final';
  if (fromEnd === 2) return 'Quarter Final';
  return `Round ${round}`;
}

/** The bracket's matches, one list per round from the first, each top to bottom. */
export function matchesByRound(t: Pick<Tournament, 'matches' | 'maxTeams'>): TournamentMatch[][] {
  return Array.from({ length: roundCount(t) }, (_, i) =>
    t.matches.filter((m) => m.round === i + 1).sort((a, b) => a.position - b.position),
  );
}

/** The winner of the final, once it is played. */
export function champion(t: Pick<Tournament, 'matches' | 'maxTeams' | 'teams'>): TournamentTeam | null {
  const final = matchesByRound(t).at(-1)?.[0];
  return final?.status === 'COMPLETED' ? teamOf(t, final.winnerTeamId) : null;
}

/** The caller's next match, with its round ("Semi Final"), the other side and the seat given. */
export function nextMatchOf(t: Tournament) {
  if (!t.myNextMatch) return null;
  const match = t.matches.find((m) => m.id === t.myNextMatch?.matchId);
  if (!match) return null;
  const opponentId = match.teamAId === t.myTeamId ? match.teamBId : match.teamAId;
  return {
    match,
    round: matchRoundName(match.round, roundCount(t)),
    team: teamOf(t, t.myTeamId),
    opponent: teamOf(t, opponentId),
    machineName: t.myNextMatch.machineName,
    pin: t.myNextMatch.pin,
  };
}
