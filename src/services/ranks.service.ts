import { api } from '../core/http/client';
import type { Rank, RankInput } from '../core/api-types';

/** The XP ranks (desk managers); everyone reads them through catalogService.paths.ranks. */
export const ranksService = {
  /** Creates the rank, or saves it when `id` is given. */
  save: (id: string | null | undefined, body: RankInput) => api<Rank>(id ? 'PATCH' : 'POST', id ? `/ranks/${id}` : '/ranks', body),
  remove: (id: string) => api('DELETE', `/ranks/${id}`).then(() => true),
};
