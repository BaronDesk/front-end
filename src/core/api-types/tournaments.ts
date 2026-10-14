/**
 * Tournaments, as the gamer app reads them. Not on the backend yet: the
 * shapes follow the planned schema (planning TODO §S1) and the app shows
 * sample data (services/tournaments.service.ts) until GET /tournaments exists.
 */

/** DRAFT is never shown to gamers. */
export type TournamentStatus = 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TournamentFormat = 'SINGLE_ELIMINATION' | 'ROUND_ROBIN';
export type MatchStatus = 'PENDING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'BYE';

export interface TournamentTeam {
  id: string;
  name: string;
  /** Bracket seed, once the bracket is drawn. */
  seed: number | null;
  /** The players' usernames, captain first. */
  members: string[];
}

export interface TournamentMatch {
  id: string;
  /** 1 = first round; the last round is the final. */
  round: number;
  /** Slot inside the round, from 1, top to bottom. */
  position: number;
  teamAId: string | null;
  teamBId: string | null;
  winnerTeamId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  scheduledAt: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  /** The cover a manager uploads (an image link like iconUrl); null: the game's poster is shown. */
  coverUrl: string | null;
  game: { id: string; name: string; iconUrl: string | null };
  branch: { id: string; name: string };
  format: TournamentFormat;
  status: TournamentStatus;
  /** Players per team: 1 is solo (1v1). */
  teamSize: number;
  maxTeams: number;
  entryFeeCoins: number;
  matchMinutes: number;
  registrationClosesAt: string;
  startsAt: string;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  /** The caller's team in it, if they registered. */
  myTeamId: string | null;
  /** The caller's next match, once seats are given: the PC and its PIN. */
  myNextMatch: { matchId: string; machineName: string; pin: string } | null;
}
