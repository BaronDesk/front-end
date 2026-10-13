import { api } from '../core/http/client';
import type { Alert } from '../core/api-types';

const ALERTS = '/api/v1/alerts';

/** The stations' alerts (desk): list them, resolve one. */
export const alertsService = {
  paths: {
    /** Latest first; `status` 'all' or omitted = every status; branchId narrows to one branch (HQ). */
    list: ({ status, limit = 500, branchId }: { status?: 'open' | 'resolved' | 'all'; limit?: number; branchId?: string } = {}) => {
      const q = new URLSearchParams();
      if (status && status !== 'all') q.set('status', status);
      if (branchId) q.set('branchId', branchId);
      q.set('limit', String(limit));
      return `${ALERTS}?${q}`;
    },
  },
  resolve: (alertId: string) => api<Alert>('POST', `${ALERTS}/${alertId}/resolve`),
};
