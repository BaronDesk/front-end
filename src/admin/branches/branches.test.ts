import { describe, expect, it } from 'vitest';

import type { Machine } from '../../api/types';
import { deriveBranches } from './branches';

const machine = (id: string, branchId: string, serialNumber: string): Machine => ({
  id,
  branchId,
  serialNumber,
  agentPublicKey: '',
  enrollmentStatus: 'ENROLLED',
  name: null,
  status: 'OFFLINE',
  lastSeen: null,
  createdAt: '2026-09-30T00:00:00Z',
});

describe('branches built from GET /machines', () => {
  it('labels a branch by its PCs serial prefix, else by a short id', () => {
    const branches = deriveBranches(
      [machine('m1', 'b-lac-0000', 'LAC-PC-01'), machine('m2', 'b-lac-0000', 'LAC-PC-02'), machine('m3', 'b-mix-0000', 'A-1'), machine('m4', 'b-mix-0000', 'B-1')],
      ['b-empty-000'],
    );
    expect(branches).toEqual([
      { id: 'b-empty-000', name: 'Branch b-empty-' },
      { id: 'b-mix-0000', name: 'Branch b-mix-00' },
      { id: 'b-lac-0000', name: 'LAC branch' },
    ]);
  });
});
