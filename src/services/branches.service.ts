import { api } from '../core/http/client';
import type { Branch } from '../core/api-types';

/** The branches (HQ): everyone reads them through catalogService.paths.branches. */
export const branchesService = {
  /** Creates the branch, or saves it when `id` is given. */
  save: (id: string | null | undefined, body: { name: string; location: string }) =>
    api<Branch>(id ? 'PATCH' : 'POST', id ? `/branches/${id}` : '/branches', body),
};
