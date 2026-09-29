/*
 * Business rules of the mock backend, shared by handlers and timers.
 * Money is computed HERE (playing the server), never in the UI.
 */
import type {
  Alert,
  AlertCategory,
  AlertSeverity,
  PublicUser,
  Session,
  SessionUpdateEvent,
  Station,
  StationDetail,
  StationStatusEvent,
  TelemetrySnapshot,
  TransactionType,
  WalletTransaction,
} from '../api/types';
import { publish } from './bus';
import { db, newId, nowIso, round3, type MockStation, type MockUser } from './db';
import { MockHttpError } from './router';

export function publicUser(u: MockUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    accountStatus: u.accountStatus,
    branchId: u.branchId,
    createdAt: u.createdAt,
  };
}

// ---------- stations ----------

const ENROLLMENT_TO_BACKEND: Record<MockStation['enrollmentStatus'], StationDetail['enrollmentStatus']> = {
  PENDING: 'PENDING',
  APPROVED: 'ENROLLED',
  REJECTED: 'INACTIVE',
  REVOKED: 'DEACTIVATED',
};

/** GET /api/v1/stations item. Unlike the real list, it carries branchId (HQ scoping). */
export function toStationDto(s: MockStation): Station {
  return {
    id: s.id,
    serialNumber: s.serialNumber,
    name: s.name,
    status: s.online ? 'ONLINE' : 'OFFLINE',
    lastSeen: s.lastSeenAt,
    locked: s.locked,
    sessionId: s.sessionId,
    runningGameId: s.runningGameId,
    ip: s.ip,
    branchId: s.branchId,
  };
}

/** GET /api/v1/stations/:id */
export function toStationDetail(s: MockStation): StationDetail {
  return {
    ...toStationDto(s),
    branchId: s.branchId,
    enrollmentStatus: ENROLLMENT_TO_BACKEND[s.enrollmentStatus],
    leaseExpiresAt: null,
  };
}

export function stationStatus(s: MockStation): StationStatusEvent {
  return {
    serialNumber: s.serialNumber,
    name: s.name,
    status: s.online ? 'ONLINE' : 'OFFLINE',
    lastSeen: s.lastSeenAt ?? nowIso(),
    ip: s.ip,
    locked: s.locked,
    sessionId: s.sessionId,
    runningGameId: s.runningGameId,
    branchId: s.branchId,
  };
}

export function publishStation(s: MockStation): void {
  publish('station_status', stationStatus(s));
}

export function setOnline(s: MockStation, online: boolean): void {
  s.online = online;
  s.lastSeenAt = nowIso();
  if (!online) s.runningGameId = null;
  publishStation(s);
}

// ---------- telemetry ----------

function jitter(prev: number | undefined, base: number, spread: number, min: number, max: number): number {
  const start = prev ?? base;
  const next = start + (Math.random() - 0.5) * spread;
  return Math.round(Math.min(max, Math.max(min, next)) * 10) / 10;
}

/** Next snapshot for a station, a random walk from the last one. Metric names = agent's mapper. */
export function nextTelemetry(s: MockStation): TelemetrySnapshot {
  const prev = new Map(Object.entries(db.telemetry.get(s.id)?.metrics ?? {}));
  const busy = s.sessionId !== null;
  const now = nowIso();
  const metrics: Record<string, number> = {
    'cpu.load_percent': jitter(prev.get('cpu.load_percent'), busy ? 55 : 8, 12, 1, 100),
    'cpu.temperature_c': jitter(prev.get('cpu.temperature_c'), busy ? 62 : 41, 4, 30, 95),
    'memory.usage_percent': jitter(prev.get('memory.usage_percent'), busy ? 61 : 28, 5, 10, 99),
    'gpu.0.load_percent': jitter(prev.get('gpu.0.load_percent'), busy ? 78 : 3, 14, 0, 100),
    'gpu.0.temperature_c': jitter(prev.get('gpu.0.temperature_c'), busy ? 70 : 38, 4, 30, 95),
    'fan.0.speed_rpm': Math.round(jitter(prev.get('fan.0.speed_rpm'), busy ? 1650 : 780, 120, 500, 2600)),
  };
  const snapshot: TelemetrySnapshot = {
    serialNumber: s.serialNumber,
    machineId: s.id,
    branchId: s.branchId,
    timestamp: now,
    receivedAt: now,
    metrics,
  };
  db.telemetry.set(s.id, snapshot);
  return snapshot;
}

// ---------- alerts ----------

export function raiseAlert(
  s: MockStation,
  category: AlertCategory,
  type: string,
  severity: AlertSeverity,
  detail: string,
): Alert {
  const alert: Alert = {
    id: newId(),
    machineId: s.id,
    branchId: s.branchId,
    category,
    type,
    severity,
    detail,
    status: 'OPEN',
    occurredAt: nowIso(),
  };
  db.alerts.unshift(alert);
  publish('alert', alert);
  return alert;
}

// ---------- wallet ----------

export function balanceOf(userId: string): number {
  return db.balances.get(userId) ?? 0;
}

/** Append a ledger line. Debits (amount < 0) fail when funds are short unless allowPartial. */
export function postTransaction(
  userId: string,
  type: TransactionType,
  amount: number,
  opts: { method?: string; note?: string; allowPartial?: boolean } = {},
): WalletTransaction {
  let delta = round3(amount);
  const balance = balanceOf(userId);
  if (delta < 0 && balance + delta < 0) {
    if (!opts.allowPartial) {
      throw new MockHttpError(402, 'INSUFFICIENT_FUNDS', `balance ${balance.toFixed(3)} is too low`);
    }
    delta = -balance;
  }
  const balanceAfter = round3(balance + delta);
  db.balances.set(userId, balanceAfter);
  const tx: WalletTransaction = {
    id: newId(),
    userId,
    type,
    amount: delta,
    balanceAfter,
    method: opts.method ?? null,
    note: opts.note ?? null,
    reversedById: null,
    createdAt: nowIso(),
  };
  db.transactions.unshift(tx);
  return tx;
}

// ---------- sessions & billing ----------

export function activeDiscount(userId: string): number {
  const now = Date.now();
  const m = db.memberships.find(
    (x) => x.userId === userId && Date.parse(x.startsAt) <= now && Date.parse(x.endsAt) > now,
  );
  return m?.discountPercent ?? 0;
}

function activePass(userId: string) {
  const now = Date.now();
  return db.subscriptions.find((x) => x.userId === userId && x.hoursLeft > 0 && Date.parse(x.endsAt) > now);
}

function costFor(session: Session, elapsedSeconds: number) {
  const rate = db.pricing.ratePerHour;
  const discountPercent = activeDiscount(session.userId);
  const hours = elapsedSeconds / 3600;
  const hoursFromPass = Math.min(hours, activePass(session.userId)?.hoursLeft ?? 0);
  const billableHours = hours - hoursFromPass;
  const subtotal = round3(billableHours * rate);
  const discount = round3((subtotal * discountPercent) / 100);
  return { rate, discountPercent, hoursFromPass, subtotal, discount, total: round3(subtotal - discount) };
}

export function sessionUpdate(session: Session): SessionUpdateEvent {
  const end = session.endedAt ? Date.parse(session.endedAt) : Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((end - Date.parse(session.startedAt)) / 1000));
  const cost = costFor(session, elapsedSeconds);
  const ended = session.status === 'ENDED';
  const balance = ended ? balanceOf(session.userId) : round3(balanceOf(session.userId) - cost.total);

  let runoutAt: string | null = null;
  if (!ended) {
    const effectiveRate = cost.rate * (1 - cost.discountPercent / 100);
    const passHoursLeft = (activePass(session.userId)?.hoursLeft ?? 0) - cost.hoursFromPass;
    const hoursLeft = Math.max(0, balance) / effectiveRate + passHoursLeft;
    runoutAt = new Date(Date.now() + hoursLeft * 3_600_000).toISOString();
  }

  return {
    sessionId: session.id,
    machineId: session.machineId,
    branchId: session.branchId,
    userId: session.userId,
    status: session.status,
    startedAt: session.startedAt,
    elapsedSeconds,
    estimatedCost: ended ? (session.billing?.total ?? 0) : cost.total,
    balance,
    runoutAt,
    billing: session.billing,
  };
}

export function startSession(userId: string, machineId: string): Session {
  const s = db.stations.find((x) => x.id === machineId);
  if (!s) throw new MockHttpError(404, 'NOT_FOUND', 'station not found');
  if (s.enrollmentStatus !== 'APPROVED') throw new MockHttpError(409, 'STATION_NOT_ENROLLED', 'station is not approved');
  if (!s.online) throw new MockHttpError(409, 'STATION_OFFLINE', 'station is offline');
  if (s.sessionId) throw new MockHttpError(409, 'STATION_BUSY', 'station already has an active session');
  if (db.sessions.some((x) => x.userId === userId && x.status !== 'ENDED')) {
    throw new MockHttpError(409, 'USER_IN_SESSION', 'this gamer already has an active session');
  }
  if (balanceOf(userId) <= 0 && !activePass(userId)) {
    throw new MockHttpError(402, 'INSUFFICIENT_FUNDS', 'balance is empty and no active pass');
  }

  const session: Session = {
    id: newId(),
    userId,
    machineId,
    branchId: s.branchId,
    status: 'ACTIVE',
    startedAt: nowIso(),
    endedAt: null,
    endReason: null,
    billing: null,
  };
  db.sessions.unshift(session);
  s.sessionId = session.id;
  s.locked = false;
  publishStation(s);
  publish('session_update', sessionUpdate(session));
  return session;
}

export function endSession(session: Session, reason: string): Session {
  if (session.status === 'ENDED') throw new MockHttpError(409, 'SESSION_ENDED', 'session already ended');

  session.endedAt = nowIso();
  const elapsedSeconds = Math.floor((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000);
  const minutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
  const cost = costFor(session, minutes * 60);

  const pass = activePass(session.userId);
  if (pass && cost.hoursFromPass > 0) pass.hoursLeft = round3(pass.hoursLeft - cost.hoursFromPass);

  let charged = 0;
  if (cost.total > 0) {
    const tx = postTransaction(session.userId, 'SESSION_CHARGE', -cost.total, {
      note: `Session ${minutes} min`,
      allowPartial: true,
    });
    charged = -tx.amount;
  }

  session.status = 'ENDED';
  session.endReason = reason;
  session.billing = {
    minutes,
    ratePerHour: cost.rate,
    subtotal: cost.subtotal,
    discountPercent: cost.discountPercent,
    discount: cost.discount,
    hoursFromPass: round3(cost.hoursFromPass),
    total: round3(charged),
  };

  const profile = db.profiles.get(session.userId);
  if (profile) {
    profile.xp += minutes;
    profile.level = 1 + Math.floor(profile.xp / 120);
  }

  const s = db.stations.find((x) => x.id === session.machineId);
  if (s) {
    s.sessionId = null;
    s.runningGameId = null;
    s.locked = true;
    publishStation(s);
  }
  publish('session_update', sessionUpdate(session));
  return session;
}

// ---------- reservations ----------

export function overlaps(machineId: string, start: string, end: string, ignoreId?: string): boolean {
  const a = Date.parse(start);
  const b = Date.parse(end);
  return db.reservations.some(
    (r) =>
      r.id !== ignoreId &&
      r.machineId === machineId &&
      r.status === 'BOOKED' &&
      Date.parse(r.start) < b &&
      a < Date.parse(r.end),
  );
}
