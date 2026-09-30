/*
 * games/ endpoints, like back-end games.controller.ts: the catalog (GET for
 * everyone, writes for MANAGER+), offering a game at a branch or on one
 * station, and a station's resolved catalog with its install report.
 * Every assignment change makes the affected stations re-sync (catalog_status).
 */
import type { Game, GameLaunchType, StationGameOverrides } from '../../api/types';
import { db, nowIso } from '../db';
import { assertBranch, badRequest, findStation, requireManager, requireStaff, requireUser } from '../guards';
import { stationGames, syncCatalogs } from '../logic';
import { MockHttpError, route } from '../router';

const LAUNCH_TYPES: GameLaunchType[] = ['exe', 'steam', 'epic'];
const WINDOWS_FULL_PATH = /^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/;

/** The backend's launchSpecError: the target's shape depends on the launch type. */
function assertLaunchSpec(spec: { launchType: GameLaunchType; target: string; workingDirectory?: string | null }): void {
  const { launchType, target } = spec;
  let error: string | null = null;
  if (launchType === 'exe') {
    if (!WINDOWS_FULL_PATH.test(target) || !target.toLowerCase().endsWith('.exe')) {
      error = 'target must be the fully qualified path of an .exe file (e.g. C:\\Games\\cs2\\cs2.exe)';
    } else if (spec.workingDirectory && !WINDOWS_FULL_PATH.test(spec.workingDirectory)) {
      error = 'workingDirectory must be a fully qualified folder path';
    }
  } else if (launchType === 'steam') {
    if (!/^\d{1,10}$/.test(target)) error = 'target must be a Steam app id (digits only)';
  } else if (!/^[A-Za-z0-9._-]{1,128}$/.test(target)) {
    error = "target must be an Epic AppName (letters, digits, '.', '_' or '-')";
  }
  if (error) throw new MockHttpError(400, 'INVALID_LAUNCH_SPEC', error);
}

function findGame(id: string): Game {
  const game = db.games.find((g) => g.id === id);
  if (!game) throw new MockHttpError(404, 'GAME_NOT_FOUND', 'game not found');
  return game;
}

function assertGameIdFree(gameId: string): void {
  if (db.games.some((g) => g.gameId === gameId)) throw new MockHttpError(409, 'GAME_ID_TAKEN', 'gameId already in use');
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Branches and stations that offer this game: they re-sync after a change. */
function reachOf(gameId: string) {
  const machineIds = [...db.machineGames].filter(([, games]) => games.has(gameId)).map(([id]) => id);
  return { branchIds: [...(db.gameBranches.get(gameId) ?? [])], machineIds };
}

function assignmentNotFound(): never {
  throw new MockHttpError(404, 'ASSIGNMENT_NOT_FOUND', 'game is not assigned there');
}

// Gamers see enabled games only; staff+ see the whole catalog.
route('GET', '/api/v1/games', (ctx) => {
  const caller = requireUser(ctx);
  const all = [...db.games].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return caller.role === 'GAMER' ? all.filter((g) => g.enabled) : all;
});

route('POST', '/api/v1/games', (ctx) => {
  requireManager(ctx);
  const b = ctx.body as Record<string, unknown>;
  const gameId = text(b.gameId);
  const name = text(b.name);
  const target = text(b.target);
  const launchType = (b.launchType ?? 'exe') as GameLaunchType;
  if (!gameId || !name || !target) badRequest('gameId, name and target are required');
  if (!LAUNCH_TYPES.includes(launchType)) badRequest('launchType must be exe, steam or epic');
  const game: Game = {
    id: crypto.randomUUID(),
    gameId,
    name,
    launchType,
    target,
    arguments: text(b.arguments),
    workingDirectory: text(b.workingDirectory),
    processName: text(b.processName),
    iconUrl: text(b.iconUrl),
    enabled: b.enabled !== false,
    sortOrder: typeof b.sortOrder === 'number' ? b.sortOrder : 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  assertLaunchSpec(game);
  assertGameIdFree(game.gameId);
  db.games.push(game); // not assigned anywhere yet: no station re-syncs
  return game;
});

route('PATCH', '/api/v1/games/:id', (ctx) => {
  requireManager(ctx);
  const game = findGame(ctx.params.id);
  const b = ctx.body as Record<string, unknown>;
  if (Object.keys(b).length === 0) badRequest('nothing to update');
  const changes: Partial<Game> = {};
  for (const key of ['gameId', 'name', 'target'] as const) {
    if (key in b) {
      const value = text(b[key]);
      if (!value) badRequest(`${key} must not be empty`);
      changes[key] = value;
    }
  }
  for (const key of ['arguments', 'workingDirectory', 'processName', 'iconUrl'] as const) {
    if (key in b) changes[key] = text(b[key]);
  }
  if ('launchType' in b) {
    if (!LAUNCH_TYPES.includes(b.launchType as GameLaunchType)) badRequest('launchType must be exe, steam or epic');
    changes.launchType = b.launchType as GameLaunchType;
  }
  if ('enabled' in b) changes.enabled = b.enabled === true;
  if (typeof b.sortOrder === 'number') changes.sortOrder = b.sortOrder;

  const merged = { ...game, ...changes };
  assertLaunchSpec(merged);
  if (changes.gameId && changes.gameId !== game.gameId) assertGameIdFree(changes.gameId);
  Object.assign(game, changes, { updatedAt: nowIso() });
  syncCatalogs(reachOf(game.id));
  return game;
});

route('PUT', '/api/v1/games/:id/branches/:branchId', (ctx) => {
  const caller = requireManager(ctx);
  assertBranch(caller, ctx.params.branchId);
  const game = findGame(ctx.params.id);
  if (!db.gameBranches.has(game.id)) db.gameBranches.set(game.id, new Set());
  db.gameBranches.get(game.id)!.add(ctx.params.branchId);
  syncCatalogs({ branchIds: [ctx.params.branchId] });
  return { gameId: game.id, branchId: ctx.params.branchId, assigned: true };
});

route('DELETE', '/api/v1/games/:id/branches/:branchId', (ctx) => {
  const caller = requireManager(ctx);
  assertBranch(caller, ctx.params.branchId);
  if (!db.gameBranches.get(ctx.params.id)?.delete(ctx.params.branchId)) assignmentNotFound();
  syncCatalogs({ branchIds: [ctx.params.branchId] });
  return { gameId: ctx.params.id, branchId: ctx.params.branchId, assigned: false };
});

route('PUT', '/api/v1/games/:id/stations/:stationId', (ctx) => {
  const caller = requireManager(ctx);
  const s = findStation(ctx.params.stationId);
  assertBranch(caller, s.branchId);
  const game = findGame(ctx.params.id);
  const b = ctx.body as StationGameOverrides;
  const overrides = { target: text(b.target), arguments: text(b.arguments), workingDirectory: text(b.workingDirectory) };
  assertLaunchSpec({
    launchType: game.launchType,
    target: overrides.target ?? game.target,
    workingDirectory: overrides.workingDirectory ?? game.workingDirectory,
  });
  if (!db.machineGames.has(s.id)) db.machineGames.set(s.id, new Map());
  db.machineGames.get(s.id)!.set(game.id, overrides);
  syncCatalogs({ machineIds: [s.id] });
  return { gameId: game.id, stationId: s.id, assigned: true, ...overrides, updatedAt: nowIso() };
});

route('DELETE', '/api/v1/games/:id/stations/:stationId', (ctx) => {
  const caller = requireManager(ctx);
  const s = findStation(ctx.params.stationId);
  assertBranch(caller, s.branchId);
  if (!db.machineGames.get(s.id)?.delete(ctx.params.id)) assignmentNotFound();
  syncCatalogs({ machineIds: [s.id] });
  return { gameId: ctx.params.id, stationId: s.id, assigned: false };
});

route('GET', '/api/v1/stations/:id/games', (ctx) => {
  const caller = requireStaff(ctx);
  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  return stationGames(s);
});
