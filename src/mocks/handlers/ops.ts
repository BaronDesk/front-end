/*
 * ops/ endpoints: remote commands and alerts. A command is answered on
 * /dashboard-io with command_result, like the real agent ack loop:
 * ~500 ms ACKED/NACKED when the station is online, TIMEOUT after 5 s if not.
 */
import type { CommandLog, CommandResultEvent, CommandType } from '../../api/types';
import { publish } from '../bus';
import { db, newId, nowIso } from '../db';
import { assertBranch, badRequest, branchFilter, findStation, notFound, requireStaff } from '../guards';
import { endSession, publishStation, setOnline } from '../logic';
import { MockHttpError, route, type MockContext } from '../router';

const COMMAND_TYPES: CommandType[] = ['UNLOCK', 'LOCK', 'SHUTDOWN', 'LAUNCH_GAME', 'END_SESSION', 'POLICY_UPDATE'];
const ACK_DELAY_MS = 500;
const TIMEOUT_MS = 5000;
/** A shut-down station "boots" again after this long, so tests can continue. */
const REBOOT_MS = 30_000;

function finish(cmd: CommandLog, status: CommandResultEvent['status'], code: string | null = null, reason: string | null = null) {
  cmd.status = status;
  cmd.code = code;
  cmd.reason = reason;
  cmd.completedAt = nowIso();
  const s = db.stations.find((x) => x.id === cmd.machineId);
  publish('command_result', {
    commandId: cmd.id,
    machineId: cmd.machineId,
    branchId: s?.branchId ?? '',
    type: cmd.type,
    status,
    code,
    reason,
  });
}

/** What the "agent" does when the command arrives. Returns a NACK reason, or null on success. */
function execute(cmd: CommandLog): { code: string; reason: string } | null {
  const s = findStation(cmd.machineId);
  switch (cmd.type) {
    case 'LOCK':
      s.locked = true;
      s.runningGameId = null;
      break;
    case 'UNLOCK':
      s.locked = false;
      break;
    case 'LAUNCH_GAME': {
      const gameId = String(cmd.payload.gameId ?? '');
      if (!(db.stationGames.get(s.id) ?? []).includes(gameId)) {
        return { code: 'EXEC_FAILED', reason: 'game is not installed on this station' };
      }
      if (s.locked) return { code: 'EXEC_FAILED', reason: 'station is locked' };
      s.runningGameId = gameId;
      break;
    }
    case 'END_SESSION': {
      const session = db.sessions.find((x) => x.id === s.sessionId);
      if (!session) return { code: 'STALE', reason: 'no active session on this station' };
      endSession(session, 'STAFF_ENDED');
      return null; // endSession already published the station change
    }
    case 'SHUTDOWN': {
      const session = db.sessions.find((x) => x.id === s.sessionId);
      if (session) endSession(session, 'SHUTDOWN');
      s.locked = true; // the agent boots back into the lock screen
      setOnline(s, false);
      setTimeout(() => setOnline(s, true), REBOOT_MS);
      return null;
    }
    case 'POLICY_UPDATE':
      break;
  }
  publishStation(s);
  return null;
}

route('POST', '/commands', (ctx) => {
  const caller = requireStaff(ctx);
  const type = ctx.body.type as CommandType;
  if (!COMMAND_TYPES.includes(type)) badRequest('unknown command type');
  const s = findStation(String(ctx.body.machineId ?? ''));
  assertBranch(caller, s.branchId);
  if (s.enrollmentStatus !== 'APPROVED') {
    throw new MockHttpError(409, 'STATION_NOT_ENROLLED', 'station is not approved');
  }
  if (type === 'POLICY_UPDATE' && caller.role === 'EMPLOYEE') {
    throw new MockHttpError(403, 'FORBIDDEN', 'requires role MANAGER or higher');
  }

  const cmd: CommandLog = {
    id: newId(),
    machineId: s.id,
    type,
    payload: (ctx.body.payload as Record<string, unknown>) ?? {},
    status: 'PENDING',
    code: null,
    reason: null,
    issuedBy: caller.id,
    issuedAt: nowIso(),
    completedAt: null,
  };
  db.commands.unshift(cmd);

  if (!s.online) {
    setTimeout(() => finish(cmd, 'TIMEOUT', 'TIMEOUT', 'no response from station'), TIMEOUT_MS);
  } else {
    setTimeout(() => {
      const nack = execute(cmd);
      if (nack) finish(cmd, 'NACKED', nack.code, nack.reason);
      else finish(cmd, 'ACKED');
    }, ACK_DELAY_MS);
  }
  return cmd;
});

route('GET', '/commands', (ctx) => {
  const caller = requireStaff(ctx);
  const machineId = ctx.query.get('machineId');
  const branch = branchFilter(caller, ctx.query.get('branchId'));
  return db.commands.filter((c) => {
    if (machineId && c.machineId !== machineId) return false;
    const s = db.stations.find((x) => x.id === c.machineId);
    return !branch || s?.branchId === branch;
  });
});

// ---------- alerts ----------

route('GET', '/alerts', (ctx) => {
  const caller = requireStaff(ctx);
  const branch = branchFilter(caller, ctx.query.get('branchId'));
  const status = ctx.query.get('status');
  const category = ctx.query.get('category');
  const severity = ctx.query.get('severity');
  const machineId = ctx.query.get('machineId');
  return db.alerts.filter(
    (a) =>
      (!branch || a.branchId === branch) &&
      (!status || a.status === status) &&
      (!category || a.category === category) &&
      (!severity || a.severity === severity) &&
      (!machineId || a.machineId === machineId),
  );
});

function alertAction(to: 'ACKED' | 'RESOLVED') {
  return (ctx: MockContext) => {
    const caller = requireStaff(ctx);
    const alert = db.alerts.find((a) => a.id === ctx.params.id) ?? notFound('alert');
    assertBranch(caller, alert.branchId);
    if (alert.status === 'RESOLVED') throw new MockHttpError(409, 'ALERT_RESOLVED', 'alert is already resolved');
    alert.status = to;
    return alert;
  };
}

route('POST', '/alerts/:id/ack', alertAction('ACKED'));
route('POST', '/alerts/:id/resolve', alertAction('RESOLVED'));
