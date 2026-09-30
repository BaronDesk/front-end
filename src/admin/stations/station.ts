import type { Station, StationStatusEvent } from '../../api/types';

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
