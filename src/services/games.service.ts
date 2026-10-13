import { api } from '../core/http/client';
import type { Game, GameInput, StationGameOverrides } from '../core/api-types';

const GAMES = '/api/v1/games';

/** The game catalog (desk managers): the games, where they are offered and installed. */
export const gamesService = {
  paths: {
    list: GAMES,
    /** What the PCs report as installed: one station's, one branch's, or every one's. */
    installed: ({ stationId, branchId }: { stationId?: string | null; branchId?: string | null }) =>
      `${GAMES}/installed${stationId ? `?stationId=${stationId}` : branchId ? `?branchId=${branchId}` : ''}`,
  },
  /** Creates the game, or saves it when `id` is given. */
  save: (id: string | null | undefined, body: GameInput) => api<Game>(id ? 'PATCH' : 'POST', id ? `${GAMES}/${id}` : GAMES, body),
  setEnabled: (id: string, enabled: boolean) => api<Game>('PATCH', `${GAMES}/${id}`, { enabled }),
  remove: (id: string) => api('DELETE', `${GAMES}/${id}`),
  /** Offers the game at every station of the branch, or stops offering it there. */
  offerAtBranch: (id: string, branchId: string, offer: boolean) => api(offer ? 'PUT' : 'DELETE', `${GAMES}/${id}/branches/${branchId}`),
  assignToStation: (id: string, stationId: string, body: StationGameOverrides) => api('PUT', `${GAMES}/${id}/stations/${stationId}`, body),
  removeFromStation: (id: string, stationId: string) => api('DELETE', `${GAMES}/${id}/stations/${stationId}`),
};
