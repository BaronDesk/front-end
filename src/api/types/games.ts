/** The game catalog, per branch and per station. */

/**
 * exe: target is the full path of the .exe. steam: target is the Steam app id.
 * epic: target is the Epic AppName (no arguments, no working directory).
 */
export type GameLaunchType = 'exe' | 'steam' | 'epic';

/** GET / POST / PATCH /api/v1/games (games/services/games.service.ts toGameDto). */
export interface Game {
  /** Row id (uuid): what the /games/:id routes and Command.gameId use. */
  id: string;
  /** Wire id (e.g. "cs2"): what LAUNCH_GAME, the agent's catalog and runningGameId use. */
  gameId: string;
  name: string;
  launchType: GameLaunchType;
  target: string;
  arguments: string | null;
  workingDirectory: string | null;
  /** e.g. cs2.exe: lets the agent track the game and close it at session end. */
  processName: string | null;
  /** /uploads/images/<id>.webp, or null. */
  iconUrl: string | null;
  /** A disabled game stays in the catalog but reaches no station. */
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Where it is offered (staff list only), limited to the caller's branch unless HQ. */
  assignments?: GameAssignments;
}

export interface GameAssignments {
  /** Offered at every station of these branches… */
  branchIds: string[];
  /** …and on these single stations… */
  stationIds: string[];
  /** …except these, taken off although their branch offers it. */
  excludedStationIds: string[];
}

/** GET /api/v1/games/installed: a launcher game the stations found installed. */
export interface InstalledGame {
  launchType: 'steam' | 'epic';
  target: string;
  name: string;
  processName: string | null;
  stations: { id: string; name: string | null; serialNumber: string }[];
  reportedAt: string;
  /** The catalog entry with this launcher target, if any. */
  catalogGame: { id: string; gameId: string; name: string } | null;
}

/** POST /api/v1/games body (PATCH takes any subset). */
export interface GameInput {
  gameId: string;
  name: string;
  launchType: GameLaunchType;
  target: string;
  arguments?: string | null;
  workingDirectory?: string | null;
  processName?: string | null;
  /** A link from uploadImage() (any other link is refused); null removes it. */
  iconUrl?: string | null;
  enabled?: boolean;
  sortOrder?: number;
}

/**
 * GET /api/v1/stations/:id/games: the station's resolved catalog (offered at
 * its branch or on the station itself, per-station overrides applied) with
 * what the agent last reported. It does not say which of the two assignments
 * put a game there.
 */
export interface StationGame {
  id: string;
  gameId: string;
  name: string;
  launchType: GameLaunchType;
  target: string;
  arguments: string | null;
  workingDirectory: string | null;
  processName: string | null;
  /** null until the station has reported on this game (after its next catalog sync). */
  installed: boolean | null;
  reason: string | null;
  reportedAt: string | null;
}

/** PUT /api/v1/games/:id/stations/:stationId body: per-station overrides, null = the game's own value. */
export interface StationGameOverrides {
  target?: string | null;
  arguments?: string | null;
  workingDirectory?: string | null;
}
