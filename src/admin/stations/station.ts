import type { Peripheral, Station, StationStatusEvent } from '../../api/types';

export const STATIONS_PATH = '/api/v1/stations';

export function isOnline(s: Pick<Station, 'status'>): boolean {
  return s.status === 'ONLINE';
}

/** The machine name is optional on the backend: fall back to the serial number. */
export function stationLabel(s: Pick<Station, 'name' | 'serialNumber'>): string {
  return s.name ?? s.serialNumber;
}

/** locked is null until the agent has reported since the server started. */
export function screenText(locked: boolean | null): string {
  if (locked === null) return 'Unknown';
  return locked ? 'Locked' : 'Unlocked';
}

/** A station row with a station_status event applied (the event is keyed by serialNumber). */
export function applyStatus<T extends Station>(s: T, e: StationStatusEvent): T {
  return {
    ...s,
    name: e.name ?? s.name,
    status: e.status,
    lastSeen: e.lastSeen,
    ip: e.ip ?? s.ip,
    locked: e.locked,
    sessionId: e.sessionId,
    runningGameId: e.runningGameId,
    branchId: e.branchId,
  };
}

/**
 * The gamer app's booking page for this station. Gamers can't list stations
 * on the backend, so the desk hands them this link (or a QR code of it).
 */
export function bookingLink(s: Pick<Station, 'id' | 'name' | 'serialNumber'>): string {
  const params = new URLSearchParams({ station: s.id, name: stationLabel(s) });
  return `${window.location.origin}/portal/#/book?${params}`;
}

/** A watched device's label: its name, else the raw device id. */
export function peripheralName(p: Peripheral): string {
  return p.name?.trim() || p.deviceId;
}

/** Disconnected devices first (what the desk must look at), then by name. */
export function sortPeripherals(list: Peripheral[]): Peripheral[] {
  return [...list].sort((a, b) => Number(a.connected) - Number(b.connected) || peripheralName(a).localeCompare(peripheralName(b)));
}

/**
 * Shut down confirmation: the server bills a running session up to now
 * before the PC powers off. `name` is one station, or e.g. "3 stations".
 */
export function shutdownConfirmText(name: string, inSession: boolean, count = 1): string {
  const it = count === 1 ? 'it' : 'them';
  const session = inSession ? ` Anyone playing on ${it} stops now: their session is ended and billed up to this moment.` : '';
  return `Shut down ${name}?${session} The PC${count === 1 ? '' : 's'} power${count === 1 ? 's' : ''} off and come${count === 1 ? 's' : ''} back only when someone switches ${it} on.`;
}

/** What the desk should do when a remote command is refused; null = show the server's own message. */
export function commandErrorHint(code: string, name: string): string | null {
  switch (code) {
    case 'NO_SESSION_TO_UNLOCK':
      return `Nobody is playing on ${name}, so there is nothing to unlock. Unlock only resumes a gamer's session; a gamer unlocks the PC by typing their PIN on its lock screen.`;
    case 'INSUFFICIENT_FUNDS':
      return `The gamer on ${name} ran out of money, so their session can't resume. Top up their wallet first, then Unlock again.`;
    case 'NO_ACTIVE_SESSION':
      return `${name} reports no session, so there is nothing to end.`;
    default:
      return null;
  }
}
