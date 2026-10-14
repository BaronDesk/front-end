/*
 * The sign-up panel's shape (the design's "Union", 309 × 194): a tab around
 * the chosen button, a little neck, and the box under them. The tab and the
 * neck can slide sideways while the box stays, so the opening moves from
 * Create Team to Join Team.
 */

/** The outline with its tab under Create Team (x 20–149), from the design. */
const CREATE_PATH =
  'M130 0C140.493 7.40896e-07 149 8.50659 149 19V25C149 35.4934 140.493 44 130 44H118.846C118.637 45.5363 118.361 48.5083 119 50.5C119.709 52.7079 121.82 54.5792 124.005 56H290C300.493 56 309 64.5066 309 75V175C309 185.493 300.493 194 290 194H19C8.50659 194 0 185.493 0 175V75C1.99733e-06 64.5066 8.50659 56 19 56H46.7607C48.5556 54.4878 50.3743 52.5438 51 50.5C51.612 48.5007 51.3474 45.5341 51.1475 44H38C28.0589 44 20 35.9411 20 26V19C20 8.50659 28.5066 0 39 0H130Z';

/** How far the tab moves to sit under Join Team (x 164–293). */
export const JOIN_SHIFT = 144;

/** Where the box starts: points above it, or at its top edge inside the neck, belong to the tab. */
const BOX_TOP = 56;
const isTab = (x: number, y: number) => y < BOX_TOP || (y === BOX_TOP && x > 40 && x < 130);

type Segment = { cmd: string; nums: number[] };

/** The path as commands with absolute numbers (M, C, H, V, Z are all it uses). */
const SEGMENTS: Segment[] = (CREATE_PATH.match(/[MCHVZ][^MCHVZ]*/g) ?? []).map((part) => ({
  cmd: part[0],
  nums: (part.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number),
}));

/** The outline with the tab moved `shift` units right (0: under Create Team, JOIN_SHIFT: under Join Team). */
export function teamPanelPath(shift: number): string {
  let y = 0;
  let x = 0;
  const move = (px: number, py: number) => (isTab(px, py) ? px + shift : px);
  return SEGMENTS.map(({ cmd, nums }) => {
    if (cmd === 'Z') return 'Z';
    if (cmd === 'H') {
      x = nums[0];
      return `H${round(move(x, y))}`;
    }
    if (cmd === 'V') {
      y = nums[0];
      return `V${round(y)}`;
    }
    const out: number[] = [];
    for (let i = 0; i < nums.length; i += 2) {
      out.push(move(nums[i], nums[i + 1]), nums[i + 1]);
      [x, y] = [nums[i], nums[i + 1]];
    }
    return cmd + out.map(round).join(' ');
  }).join('');
}

const round = (n: number) => Math.round(n * 1000) / 1000;
