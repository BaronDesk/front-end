import { api } from '../core/http/client';
import type { EnrollmentToken, Machine, MachineEnrollmentStatus } from '../core/api-types';

const MACHINES = '/machines';

/** Enrolling PCs (desk managers): approve or reject a new PC, issue enrollment tokens. */
export const machinesService = {
  paths: {
    list: (status: MachineEnrollmentStatus | 'ALL' = 'ALL') => (status === 'ALL' ? MACHINES : `${MACHINES}?status=${status}`),
    all: MACHINES,
  },
  decide: (id: string, verb: 'approve' | 'reject' | 'revoke') => api<Machine>('POST', `${MACHINES}/${id}/${verb}`),
  /** A one-time token a new PC of the branch enrolls with. */
  newEnrollmentToken: (branchId: string, ttlMinutes: number) => api<EnrollmentToken>('POST', `${MACHINES}/enrollment-tokens`, { branchId, ttlMinutes }),
  /** A new token for an enrolled PC (it must enroll again with it). */
  rotateToken: (id: string) => api<EnrollmentToken>('POST', `${MACHINES}/${id}/rotate-token`),
};
