import { describe, expect, it } from 'vitest';

import type { PublicUser } from '../../api/types';
import { addRecent, exactMatch, toWalletGamers } from './wallet';

const gamer = (username: string, gamerProfileId: string | null): PublicUser => ({
  id: `u-${username}`,
  username,
  role: gamerProfileId ? 'GAMER' : 'EMPLOYEE',
  accountStatus: 'ACTIVE',
  branchId: null,
  gamerProfileId,
  homeBranchId: null,
  createdAt: '2026-10-01T00:00:00Z',
});

describe('desk wallet: find the gamer by username', () => {
  it('keeps only accounts with a gamer profile', () => {
    expect(toWalletGamers([gamer('sami', 'gp1'), gamer('staff', null)])).toEqual([{ gamerProfileId: 'gp1', username: 'sami' }]);
  });

  it('opens straight away only on an exact username, any case', () => {
    const found = toWalletGamers([gamer('sami', 'gp1'), gamer('sami99', 'gp2')]);
    expect(exactMatch(found, ' SAMI ')).toEqual({ gamerProfileId: 'gp1', username: 'sami' });
    expect(exactMatch(found, 'sam')).toBeNull();
  });

  it('remembers recent gamers newest first, without duplicates, capped', () => {
    const a = { gamerProfileId: 'a', username: 'a' };
    const b = { gamerProfileId: 'b', username: 'b' };
    const c = { gamerProfileId: 'c', username: 'c' };
    expect(addRecent([a, b], b)).toEqual([b, a]);
    expect(addRecent([a, b], c, 2)).toEqual([c, a]);
  });
});
