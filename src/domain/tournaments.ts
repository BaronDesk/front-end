import type { Tournament, TournamentMatch, TournamentStatus, TournamentTeam } from '../core/api-types';

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

/** "1v1 · Single elimination", "5v5 · Round robin". */
export function formatText(t: Pick<Tournament, 'teamSize' | 'format'>): string {
  return `${t.teamSize}v${t.teamSize} · ${t.format === 'ROUND_ROBIN' ? 'Round robin' : 'Single elimination'}`;
}

/** "5 / 8 players" for solo play, "8 / 8 teams" otherwise. */
export function placesText(t: Pick<Tournament, 'teamSize' | 'teams' | 'maxTeams'>): string {
  return `${t.teams.length} / ${t.maxTeams} ${t.teamSize === 1 ? 'players' : 'teams'}`;
}

/** The cover to show: the uploaded one, else the game's poster (null: neither). */
export function coverOf(t: Pick<Tournament, 'coverUrl' | 'game'>): string | null {
  return t.coverUrl ?? t.game.iconUrl;
}

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

/** The bracket's matches, one list per round from the first, each top to bottom. */
export function matchesByRound(t: Pick<Tournament, 'matches' | 'maxTeams'>): TournamentMatch[][] {
  return Array.from({ length: roundCount(t) }, (_, i) =>
    t.matches.filter((m) => m.round === i + 1).sort((a, b) => a.position - b.position),
  );
}

export function teamOf(t: Pick<Tournament, 'teams'>, id: string | null): TournamentTeam | null {
  return t.teams.find((team) => team.id === id) ?? null;
}

/** The winner of the final, once it is played. */
export function champion(t: Pick<Tournament, 'matches' | 'maxTeams' | 'teams'>): TournamentTeam | null {
  const final = matchesByRound(t).at(-1)?.[0];
  return final?.status === 'COMPLETED' ? teamOf(t, final.winnerTeamId) : null;
}

/** The caller's next match, with its round name, the other side and the seat given. */
export function nextMatchOf(t: Tournament) {
  if (!t.myNextMatch) return null;
  const match = t.matches.find((m) => m.id === t.myNextMatch?.matchId);
  if (!match) return null;
  const opponentId = match.teamAId === t.myTeamId ? match.teamBId : match.teamAId;
  return {
    match,
    round: roundName(match.round, roundCount(t)),
    team: teamOf(t, t.myTeamId),
    opponent: teamOf(t, opponentId),
    machineName: t.myNextMatch.machineName,
    pin: t.myNextMatch.pin,
  };
}
