import { describe, expect, it } from 'vitest';

import { JOIN_SHIFT, teamPanelPath } from './teamPanelPath';

/** The x of every point in a path drawn by teamPanelPath, with its y (H keeps the last y). */
function points(d: string): [number, number][] {
  const out: [number, number][] = [];
  let y = 0;
  for (const part of d.match(/[MCHVZ][^MCHVZ]*/g) ?? []) {
    const nums = (part.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    if (part[0] === 'H') out.push([nums[0], y]);
    else if (part[0] === 'V') y = nums[0];
    else for (let i = 0; i < nums.length; i += 2) out.push([nums[i], (y = nums[i + 1])]);
  }
  return out;
}

const xs = (list: [number, number][], keep: (y: number) => boolean) => list.filter(([, y]) => keep(y)).map(([x]) => x);

describe('the sign-up panel shape', () => {
  it('has its tab under Create Team, and slides it under Join Team without moving the box', () => {
    const create = points(teamPanelPath(0));
    const join = points(teamPanelPath(JOIN_SHIFT));
    expect(Math.min(...xs(create, (y) => y <= 44))).toBe(20);
    expect(Math.max(...xs(create, (y) => y <= 44))).toBe(149);
    expect(Math.min(...xs(join, (y) => y <= 44))).toBe(164);
    expect(Math.max(...xs(join, (y) => y <= 44))).toBe(293);
    // the box (below the neck) stays where it is
    expect(xs(join, (y) => y > 56)).toEqual(xs(create, (y) => y > 56));
  });

  it('moves part of the way for a step of the slide', () => {
    const half = points(teamPanelPath(JOIN_SHIFT / 2));
    expect(Math.min(...xs(half, (y) => y <= 44))).toBe(92);
  });
});
