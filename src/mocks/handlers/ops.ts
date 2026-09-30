/*
 * ops/ endpoints: remote commands and alerts. Commands follow the real
 * backend (ops/services/commands.service.ts): every rejection happens before a
 * row exists (409 STATION_OFFLINE, STATION_NOT_IN_SESSION, NO_ACTIVE_SESSION…);
 * otherwise the row goes PENDING → SENT → ACKED / FAILED / NACKED / TIMEOUT,
 * each step pushed as command_update on /dashboard-io.
 */
import type { Command, CommandStatus, CommandType } from '../../api/types';
import { publish } from '../bus';
import { db, newId, nowIso } from '../db';
import { assertBranch, badRequest, branchFilter, findStation, requireStaff } from '../guards';
import { endSession, findLaunchable, publishStation, setOnline } from '../logic';
import { MockHttpError, route } from '../router';

const COMMAND_TYPES: CommandType[] = ['LOCK', 'UNLOCK', 'SHUTDOWN', 'LAUNCH_GAME', 'END_SESSION', 'CATALOG_UPDATE'];
const SEND_DELAY_MS = 100;
const ACK_DELAY_MS = 500;
/** A shut-down station "boots" again after this long, so tests can continue. */
const REBOOT_MS = 30_000;
/** Nacks that end as FAILED; any other code (STALE) ends as NACKED. */
const FAILED_NACKS = new Set(['UNKNOWN_TYPE', 'INVALID_PAYLOAD', 'EXEC_FAILED']);

function update(cmd: Command, changes: Partial<Command>): void {
  Object.assign(cmd, changes);
  publish('command_update', { ...cmd });
}

function reply(cmd: Command, nack: { code: string; reason: string } | null): void {
  const resolvedAt = nowIso();
  if (!nack) {
    update(cmd, { status: 'ACKED', resolvedAt });
    return;
  }
  const status: CommandStatus = FAILED_NACKS.has(nack.code) ? 'FAILED' : 'NACKED';
  update(cmd, { status, resolvedAt, nackCode: nack.code, nackReason: nack.reason });
}

/** What the "agent" does when the command arrives. Returns a nack, or null on success. */
function execute(cmd: Command): { code: string; reason: string } | null {
  const s = findStation(cmd.machineId);
  switch (cmd.type) {
    case 'LOCK':
      s.locked = true;
      s.runningGameId = null;
      break;
    case 'UNLOCK':
      s.locked = false;
      break;
    case 'LAUNCH_GAME':
      if (s.locked || !s.sessionId) return { code: 'EXEC_FAILED', reason: 'must be unlocked with an active session' };
      // The station reports the wire gameId; the command row holds the game's row id.
      s.runningGameId = db.games.find((g) => g.id === cmd.gameId)?.gameId ?? null;
      break;
    case 'END_SESSION': {
      const session = db.sessions.find((x) => x.id === s.sessionId);
      if (session) endSession(session, 'STAFF_ENDED'); // publishes the station change
      return null;
    }
    case 'SHUTDOWN': {
      const session = db.sessions.find((x) => x.id === s.sessionId);
      if (session) endSession(session, 'SHUTDOWN');
      s.locked = true; // the agent boots back into the lock screen
      setOnline(s, false);
      setTimeout(() => setOnline(s, true), REBOOT_MS);
      return null;
    }
    case 'CATALOG_UPDATE':
      return null;
  }
  publishStation(s);
  return null;
}

route('POST', '/api/v1/stations/:id/commands', (ctx) => {
  const caller = requireStaff(ctx);
  const type = ctx.body.type as CommandType;
  if (!COMMAND_TYPES.includes(type)) badRequest('invalid command type');
  const gameId = typeof ctx.body.gameId === 'string' ? ctx.body.gameId.trim() : '';
  if (type === 'LAUNCH_GAME' && !gameId) badRequest('gameId is required for LAUNCH_GAME');
  if (type !== 'LAUNCH_GAME' && gameId) badRequest('gameId is only accepted for LAUNCH_GAME');
  if (type !== 'END_SESSION' && ctx.body.reason) badRequest('reason is only accepted for END_SESSION');
  if (type === 'SHUTDOWN' && caller.role === 'EMPLOYEE') {
    throw new MockHttpError(403, 'INSUFFICIENT_SCOPE', 'SHUTDOWN requires admin scope');
  }

  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  if (s.enrollmentStatus !== 'ENROLLED') {
    throw new MockHttpError(409, 'STATION_NOT_ENROLLED', 'station is not approved');
  }
  if (!s.online) throw new MockHttpError(409, 'STATION_OFFLINE', 'station is not online');
  // LAUNCH_GAME takes the wire gameId; the command row records the game's row id.
  let gameRowId: string | null = null;
  if (type === 'LAUNCH_GAME') {
    if (s.locked || !s.sessionId) {
      throw new MockHttpError(409, 'STATION_NOT_IN_SESSION', 'station must be unlocked with an active session to launch a game');
    }
    gameRowId = findLaunchable(s, gameId).id;
  }
  if (type === 'END_SESSION' && !s.sessionId) {
    throw new MockHttpError(409, 'NO_ACTIVE_SESSION', 'station has no active session');
  }

  const cmd: Command = {
    commandId: newId(),
    machineId: s.id,
    branchId: s.branchId,
    type,
    gameId: gameRowId,
    status: 'PENDING',
    issuedBy: caller.id,
    issuedAt: nowIso(),
    sentAt: null,
    resolvedAt: null,
    attempts: 0,
    nackCode: null,
    nackReason: null,
    failureReason: null,
  };
  db.commands.unshift(cmd);
  publish('command_update', { ...cmd });

  setTimeout(() => update(cmd, { status: 'SENT', sentAt: nowIso(), attempts: cmd.attempts + 1 }), SEND_DELAY_MS);
  setTimeout(() => {
    // Went offline after the POST (e.g. the flaky SOU-03): the ack never comes.
    if (!s.online) update(cmd, { status: 'TIMEOUT', resolvedAt: nowIso(), failureReason: 'no ack from the station' });
    else reply(cmd, execute(cmd));
  }, ACK_DELAY_MS);
  return { ...cmd };
});

route('GET', '/api/v1/stations/:id/commands', (ctx) => {
  const caller = requireStaff(ctx);
  const s = findStation(ctx.params.id);
  assertBranch(caller, s.branchId);
  const limit = Math.min(100, Math.max(1, Number(ctx.query.get('limit') ?? 20) || 20));
  return db.commands.filter((c) => c.machineId === s.id).slice(0, limit);
});

route('GET', '/api/v1/commands/:commandId', (ctx) => {
  const caller = requireStaff(ctx);
  const cmd = db.commands.find((c) => c.commandId === ctx.params.commandId);
  if (!cmd) throw new MockHttpError(404, 'COMMAND_NOT_FOUND', 'command not found');
  assertBranch(caller, cmd.branchId);
  return cmd;
});

// ---------- alerts ----------

// Like ops/services/alerts.service.ts: HQ may filter by ?branchId=, staff only
// ask for their own branch (403 otherwise). No category/severity filter.
route('GET', '/api/v1/alerts', (ctx) => {
  const caller = requireStaff(ctx);
  const requested = ctx.query.get('branchId');
  if (requested) assertBranch(caller, requested);
  const branch = branchFilter(caller, requested);
  const status = ctx.query.get('status');
  if (status && status !== 'open' && status !== 'resolved') badRequest('status must be open or resolved');
  const limit = Math.min(500, Math.max(1, Number(ctx.query.get('limit') ?? 100) || 100));
  return db.alerts
    .filter(
      (a) =>
        (!branch || a.branchId === branch) &&
        (!status || a.acknowledged === (status === 'resolved')),
    )
    .slice(0, limit);
});

// Idempotent: resolving a resolved alert returns it unchanged, with no event.
route('POST', '/api/v1/alerts/:id/resolve', (ctx) => {
  const caller = requireStaff(ctx);
  const alert = db.alerts.find((a) => a.id === ctx.params.id);
  if (!alert) throw new MockHttpError(404, 'ALERT_NOT_FOUND', 'alert not found');
  if (alert.branchId) assertBranch(caller, alert.branchId);
  if (alert.acknowledged) return alert;
  Object.assign(alert, { acknowledged: true, acknowledgedByUserId: caller.id, acknowledgedAt: nowIso() });
  publish('alert_resolved', { ...alert });
  return alert;
});
