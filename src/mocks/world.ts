/*
 * The mock backend's clock: things that happen on their own, so live
 * screens have something to show without a real agent.
 *
 *   every  2 s  telemetry_update for each online station
 *   every 10 s  session_update for running sessions; low-balance warning; auto-end at run-out
 *   every 30 s  SOU-03 flips online/offline (Node Tracking)
 *   every 45 s  a random alert (overheating or USB device removed)
 *   after 60 s  a new station TUN-07 asks to enroll
 */
import type { Station } from '../api/types';
import { publish } from './bus';
import { db, FLAKY_STATION_ID, newId, nowIso } from './db';
import { endSession, nextTelemetry, publishStation, raiseAlert, sessionUpdate, setOnline, startSession } from './logic';

const TELEMETRY_MS = 2_000;
const SESSION_MS = 10_000;
const FLAKY_MS = 30_000;
const ALERT_MS = 45_000;
const ENROLL_AFTER_MS = 60_000;

let started = false;

function liveStations(): Station[] {
  return db.stations.filter((s) => s.enrollmentStatus === 'APPROVED' && s.online);
}

function tickTelemetry(): void {
  for (const s of liveStations()) {
    s.lastSeenAt = nowIso();
    publish('telemetry_update', { machineId: s.id, branchId: s.branchId, samples: nextTelemetry(s) });
  }
}

export function tickSessions(): void {
  for (const session of db.sessions.filter((s) => s.status !== 'ENDED')) {
    const live = sessionUpdate(session);
    if (live.balance <= 0 && live.runoutAt && Date.parse(live.runoutAt) <= Date.now()) {
      endSession(session, 'BALANCE_EXHAUSTED'); // locks the station and publishes
      continue;
    }
    const minutesLeft = live.runoutAt ? (Date.parse(live.runoutAt) - Date.now()) / 60_000 : Infinity;
    if (session.status === 'ACTIVE' && minutesLeft <= db.pricing.lowBalanceMinutes) {
      session.status = 'WARNED';
    }
    publish('session_update', sessionUpdate(session));
  }
}

function flipFlaky(): void {
  const s = db.stations.find((x) => x.id === FLAKY_STATION_ID);
  if (s && s.enrollmentStatus === 'APPROVED' && !s.sessionId) setOnline(s, !s.online);
}

let alertCount = 0;
/** Raise one alert on a random online station now (also a dev helper: barondesk.simulateAlert()). */
export function randomAlert(): void {
  const candidates = liveStations();
  if (candidates.length === 0) return;
  const s = candidates[Math.floor(Math.random() * candidates.length)];
  alertCount += 1;
  if (alertCount % 2 === 1) {
    raiseAlert(s, 'hardware', 'TEMPERATURE_WARNING', 'MEDIUM', 'CPU temperature 88 °C (threshold 85 °C)');
  } else {
    raiseAlert(s, 'anti_theft', 'DEVICE_REMOVED', 'HIGH', 'USB keyboard "HyperX Alloy" disconnected');
  }
}

/**
 * Dev helper for the portal: barondesk.startSession('lowbalance') starts a
 * session for that gamer on a free station, as the desk would. Returns the station name.
 */
export function startDemoSession(username: string): string {
  const user = db.users.find((u) => u.username === username);
  if (!user) throw new Error(`no user ${username}`);
  const free = db.stations.find((s) => s.enrollmentStatus === 'APPROVED' && s.online && !s.sessionId);
  if (!free) throw new Error('no free station');
  startSession(user.id, free.id);
  return free.name;
}

function newEnrollmentRequest(): void {
  const branchId = db.branches[0].id;
  const s: Station = {
    id: newId(),
    branchId,
    name: 'TUN-07',
    mac: '00:1A:2B:3C:4D:77',
    ip: '192.168.10.107',
    enrollmentStatus: 'PENDING',
    online: true,
    locked: true,
    sessionId: null,
    runningGameId: null,
    lastSeenAt: nowIso(),
  };
  db.stations.push(s);
  db.stationGames.set(s.id, []);
  publishStation(s);
}

/** Starts the timers once, on the first mock request or realtime connect. */
export function startWorld(): void {
  if (started) return;
  started = true;
  for (const s of liveStations()) nextTelemetry(s);
  setInterval(tickTelemetry, TELEMETRY_MS);
  setInterval(tickSessions, SESSION_MS);
  setInterval(flipFlaky, FLAKY_MS);
  setInterval(randomAlert, ALERT_MS);
  setTimeout(newEnrollmentRequest, ENROLL_AFTER_MS);
}
