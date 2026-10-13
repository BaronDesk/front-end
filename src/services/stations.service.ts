import { api } from '../core/http/client';
import type { Command, IssueCommandBody, StationDetail } from '../core/api-types';

const STATIONS = '/api/v1/stations';

/** The branch's PCs (desk): their state, telemetry, games and commands. */
export const stationsService = {
  paths: {
    list: STATIONS,
    one: (id: string) => `${STATIONS}/${id}`,
    telemetry: (id: string) => `${STATIONS}/${id}/telemetry`,
    telemetryHistory: (id: string, hours: number) => `${STATIONS}/${id}/telemetry/history?hours=${hours}`,
    games: (id: string) => `${STATIONS}/${id}/games`,
    commands: (id: string, limit: number) => `${STATIONS}/${id}/commands?limit=${limit}`,
  },
  rename: (id: string, name: string) => api<StationDetail>('PATCH', `${STATIONS}/${id}`, { name }),
  /** Lock, unlock, restart, shut down, launch… (the PC answers on the live channel). */
  sendCommand: (id: string, body: IssueCommandBody) => api<Command>('POST', `${STATIONS}/${id}/commands`, body),
};
