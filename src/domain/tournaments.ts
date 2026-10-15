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

// ---------- Running a tournament (the desk) ----------

/** The usual seed order of a bracket of `size` places, top to bottom: 1, 8, 4, 5, 2, 7, 3, 6 for 8 (seed 1 meets seed 2 only in the final). */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/**
 * A single-elimination bracket for these teams, in seed order (the first
 * team is seed 1): the places are rounded up to a power of two, and the top
 * seeds get the byes (straight to round 2). Round 1 starts at `startsAt`,
 * each later round `matchMinutes` after the one before.
 */
export function drawBracket(t: Pick<Tournament, 'id' | 'teams' | 'startsAt' | 'matchMinutes'>): { teams: TournamentTeam[]; matches: TournamentMatch[] } {
  if (t.teams.length < 2) throw new Error('A bracket needs at least 2 teams.');
  const teams = t.teams.map((team, i) => ({ ...team, seed: i + 1 }));
  const size = 2 ** Math.ceil(Math.log2(teams.length));
  const rounds = Math.log2(size);
  const at = (round: number) => new Date(Date.parse(t.startsAt) + (round - 1) * t.matchMinutes * 60_000).toISOString();
  const order = seedOrder(size);
  let matches: TournamentMatch[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (let position = 1; position <= size / 2 ** round; position++) {
      const a = round === 1 ? teams[order[2 * position - 2] - 1] : undefined;
      const b = round === 1 ? teams[order[2 * position - 1] - 1] : undefined;
      matches.push({
        id: `${t.id}-m${round}-${position}`,
        round,
        position,
        teamAId: a?.id ?? null,
        teamBId: b?.id ?? null,
        winnerTeamId: null,
        scoreA: null,
        scoreB: null,
        status: round === 1 ? 'READY' : 'PENDING',
        scheduledAt: at(round),
      });
    }
  }
  // A team with no opponent (a bye) goes straight to the next round.
  for (const m of matches.filter((x) => x.round === 1 && (!x.teamAId || !x.teamBId))) {
    matches = advance(matches, { ...m, status: 'BYE', winnerTeamId: m.teamAId ?? m.teamBId });
  }
  return { teams, matches };
}

/** `done` (played or a bye) in the bracket, and its winner moved into its next match (which is ready once both sides are known). */
function advance(matches: TournamentMatch[], done: TournamentMatch): TournamentMatch[] {
  const nextPos = Math.ceil(done.position / 2);
  return matches.map((m): TournamentMatch => {
    if (m.id === done.id) return done;
    if (m.round !== done.round + 1 || m.position !== nextPos) return m;
    const placed = done.position % 2 ? { ...m, teamAId: done.winnerTeamId } : { ...m, teamBId: done.winnerTeamId };
    return { ...placed, status: placed.teamAId && placed.teamBId ? 'READY' : 'PENDING' };
  });
}

/** The matches whose result can be entered: both sides known, not played yet. */
export function matchesToPlay(t: Pick<Tournament, 'matches'>): TournamentMatch[] {
  return t.matches
    .filter((m) => m.teamAId && m.teamBId && (m.status === 'READY' || m.status === 'IN_PROGRESS'))
    .sort((a, b) => a.round - b.round || a.position - b.position);
}

/** A played match's score: the higher one wins and moves on (single elimination has no draws). */
export function reportResult(matches: TournamentMatch[], matchId: string, scoreA: number, scoreB: number): TournamentMatch[] {
  const match = matches.find((m) => m.id === matchId);
  if (!match || !match.teamAId || !match.teamBId) throw new Error('This match is not ready to be played.');
  if (match.status === 'COMPLETED') throw new Error('This match already has a result.');
  if (![scoreA, scoreB].every((s) => Number.isInteger(s) && s >= 0)) throw new Error('Scores are whole numbers, 0 or more.');
  if (scoreA === scoreB) throw new Error('A match needs a winner: the scores cannot be equal.');
  return advance(matches, { ...match, scoreA, scoreB, status: 'COMPLETED', winnerTeamId: scoreA > scoreB ? match.teamAId : match.teamBId });
}

/** What the desk can do next with a tournament, in its order of life: sign-up → bracket → play → over. */
export function adminSteps(t: Pick<Tournament, 'status' | 'teams' | 'matches'>): ('close' | 'reopen' | 'draw' | 'start' | 'cancel')[] {
  switch (t.status) {
    case 'REGISTRATION_OPEN':
      return ['close', 'cancel'];
    case 'REGISTRATION_CLOSED':
      return t.matches.length ? ['start', 'cancel'] : ['draw', 'reopen', 'cancel'];
    case 'IN_PROGRESS':
      return ['cancel'];
    default:
      return [];
  }
}
