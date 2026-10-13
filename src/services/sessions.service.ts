import { api } from '../core/http/client';
import type { Command } from '../core/api-types';

/** Sessions: the gamer reads their own; the desk lists the branch's and ends one. */
export const sessionsService = {
  paths: {
    current: '/sessions/me/current',
    history: '/sessions/me/history',
    list: (params: URLSearchParams) => `/sessions?${params}`,
    one: (id: string) => `/sessions/${id}`,
  },
  /** The desk ends it: the PC locks and the bill is settled. */
  end: (id: string) => api<Command>('POST', `/sessions/${id}/end`, { reason: 'staff_end' }),
};

/** GET /sessions/me/history: a settled session of the gamer. */
export interface SessionHistoryRow {
  sessionId: string;
  stationName: string;
  branchName: string;
  startTime: string;
  settledAt: string;
  meteredSeconds: number;
  totalCoins: number;
  chargedCoins: number;
  xpEarned: number | null;
}
