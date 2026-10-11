import { describe, expect, it } from 'vitest';

import { xpProgress } from './XpBar';

const rank = (name: string, minXp: number) => ({ id: name, name, minXp, badgeUrl: null });
const wood = rank('Wood', 0);
const bronze = rank('Bronze', 500);
const silver = rank('Silver', 1500);

describe('xpProgress', () => {
  it('fills from the current rank towards the next one', () => {
    expect(xpProgress({ xp: 250, rank: wood, nextRank: bronze })).toBe(0.5);
    expect(xpProgress({ xp: 1000, rank: bronze, nextRank: silver })).toBe(0.5);
  });

  it('is full at the top rank', () => {
    expect(xpProgress({ xp: 99_999, rank: silver, nextRank: null })).toBe(1);
  });

  it('counts from 0 below the lowest rank', () => {
    expect(xpProgress({ xp: 100, rank: null, nextRank: bronze })).toBe(0.2);
  });

  it('stays between 0 and 1', () => {
    expect(xpProgress({ xp: -5, rank: wood, nextRank: bronze })).toBe(0);
    expect(xpProgress({ xp: 900, rank: wood, nextRank: bronze })).toBe(1);
  });
});
