import type { MatchStatus, Tournament, TournamentMatch, TournamentTeam } from '../core/api-types';

/*
 * Sample tournaments, shown until the backend has GET /tournaments. Dates
 * are relative to today, so the samples stay current. Covers are left empty:
 * the page shows the game's poster from the catalog instead.
 */

const QUARTER = 15 * 60_000;

/** `days` from today at hh:mm, local time. */
function dayAt(now: Date, days: number, hh: number, mm = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

/** `hours` from now, on the next quarter hour. */
function inHours(now: Date, hours: number): string {
  return new Date(Math.ceil((now.getTime() + hours * 3_600_000) / QUARTER) * QUARTER).toISOString();
}

function teams(prefix: string, names: string[], size: number): TournamentTeam[] {
  return names.map((name, i) => ({
    id: `${prefix}-${i + 1}`,
    name,
    seed: i + 1,
    members: size === 1 ? [name] : Array.from({ length: size }, (_, k) => `${name.split(' ')[0].toLowerCase()}.${k + 1}`),
  }));
}

/** A match; a played one (COMPLETED) is won by the higher score. */
function match(
  prefix: string,
  round: number,
  position: number,
  a: string | null,
  b: string | null,
  opts: { score?: [number, number]; status?: MatchStatus; at?: string | null } = {},
): TournamentMatch {
  const status = opts.status ?? (opts.score ? 'COMPLETED' : 'PENDING');
  const [scoreA, scoreB] = opts.score ?? [null, null];
  return {
    id: `${prefix}-m${round}-${position}`,
    round,
    position,
    teamAId: a && `${prefix}-${a}`,
    teamBId: b && `${prefix}-${b}`,
    winnerTeamId: status === 'COMPLETED' && scoreA !== null && scoreB !== null ? `${prefix}-${scoreA > scoreB ? a : b}` : null,
    scoreA,
    scoreB,
    status,
    scheduledAt: opts.at ?? null,
  };
}

const EL_MANAR = { id: 'branch-el-manar', name: 'CENTRE El Manar' };
const LAC_2 = { id: 'branch-lac-2', name: 'CENTRE Lac 2' };

export function sampleTournaments(now = new Date()): Tournament[] {
  const riftStart = dayAt(now, -1, 18);
  const jamStart = dayAt(now, 6, 14);
  return [
    {
      id: 'rift-masters',
      name: 'Rift Masters',
      coverUrl: null,
      game: { id: 'league-of-legends', name: 'League of Legends', iconUrl: null },
      branch: EL_MANAR,
      format: 'SINGLE_ELIMINATION',
      status: 'IN_PROGRESS',
      teamSize: 5,
      maxTeams: 8,
      entryFeeCoins: 10_000,
      matchMinutes: 60,
      registrationClosesAt: dayAt(now, -2, 23, 59),
      startsAt: riftStart,
      teams: teams('rm', ['Baron Wolves', 'Lac Legends', 'Night Owls', 'Pixel Pirates', 'Red Rift', 'Carthage Kings', 'Sidi Snipers', 'Byrsa Bears'], 5),
      matches: [
        match('rm', 1, 1, '1', '8', { score: [1, 0], at: riftStart }),
        match('rm', 1, 2, '4', '2', { score: [0, 1], at: riftStart }),
        match('rm', 1, 3, '3', '7', { score: [1, 0], at: riftStart }),
        match('rm', 1, 4, '5', '6', { score: [0, 1], at: riftStart }),
        match('rm', 2, 1, '1', '2', { status: 'READY', at: inHours(now, 2) }),
        match('rm', 2, 2, '3', '6', { status: 'IN_PROGRESS', score: [1, 0], at: inHours(now, -0.5) }),
        match('rm', 3, 1, null, null, { at: inHours(now, 4) }),
      ],
      myTeamId: 'rm-1',
      myNextMatch: { matchId: 'rm-m2-1', machineName: 'PC-03', pin: '482913' },
    },
    {
      id: 'baron-brawl-cup',
      name: 'Baron Brawl Cup',
      coverUrl: null,
      game: { id: 'brawlhalla', name: 'Brawlhalla', iconUrl: null },
      branch: EL_MANAR,
      format: 'SINGLE_ELIMINATION',
      status: 'REGISTRATION_OPEN',
      teamSize: 1,
      maxTeams: 8,
      entryFeeCoins: 2_000,
      matchMinutes: 20,
      registrationClosesAt: dayAt(now, 3, 23, 59),
      startsAt: dayAt(now, 4, 18),
      teams: teams('bc', ['ShadowKick', 'Nour', 'Yassine', 'Mehdi', 'Lina'], 1).map((t) => ({ ...t, seed: null })),
      matches: [],
      myTeamId: null,
      myNextMatch: null,
    },
    {
      id: 'block-builders-jam',
      name: 'Block Builders Jam',
      coverUrl: null,
      game: { id: 'minecraft', name: 'Minecraft', iconUrl: null },
      branch: LAC_2,
      format: 'SINGLE_ELIMINATION',
      status: 'REGISTRATION_CLOSED',
      teamSize: 2,
      maxTeams: 8,
      entryFeeCoins: 0,
      matchMinutes: 45,
      registrationClosesAt: dayAt(now, -1, 23, 59),
      startsAt: jamStart,
      teams: teams('bj', ['Creeper Crew', 'Redstone Duo', 'Diamond Diggers', 'Ender Pair', 'Nether Nomads', 'Block Party', 'Pixel Smiths', 'Lava Lords'], 2),
      matches: [
        match('bj', 1, 1, '1', '8', { at: jamStart }),
        match('bj', 1, 2, '4', '5', { at: jamStart }),
        match('bj', 1, 3, '3', '6', { at: dayAt(now, 6, 15) }),
        match('bj', 1, 4, '2', '7', { at: dayAt(now, 6, 15) }),
        match('bj', 2, 1, null, null, { at: dayAt(now, 6, 16) }),
        match('bj', 2, 2, null, null, { at: dayAt(now, 6, 16) }),
        match('bj', 3, 1, null, null, { at: dayAt(now, 6, 17) }),
      ],
      myTeamId: null,
      myNextMatch: null,
    },
    {
      id: 'brawl-night-3',
      name: 'Brawl Night #3',
      coverUrl: null,
      game: { id: 'brawlhalla', name: 'Brawlhalla', iconUrl: null },
      branch: EL_MANAR,
      format: 'SINGLE_ELIMINATION',
      status: 'COMPLETED',
      teamSize: 1,
      maxTeams: 8,
      entryFeeCoins: 1_000,
      matchMinutes: 20,
      registrationClosesAt: dayAt(now, -7, 23, 59),
      startsAt: dayAt(now, -6, 19),
      teams: teams('bn', ['ShadowKick', 'Aziz', 'Mariem', 'Omar', 'Sami', 'Ines', 'Karim', 'Hedi'], 1),
      matches: [
        match('bn', 1, 1, '1', '8', { score: [2, 0] }),
        match('bn', 1, 2, '4', '5', { score: [2, 1] }),
        match('bn', 1, 3, '3', '6', { score: [1, 2] }),
        match('bn', 1, 4, '2', '7', { score: [2, 0] }),
        match('bn', 2, 1, '1', '4', { score: [2, 1] }),
        match('bn', 2, 2, '6', '2', { score: [0, 2] }),
        match('bn', 3, 1, '1', '2', { score: [3, 1] }),
      ],
      myTeamId: null,
      myNextMatch: null,
    },
  ];
}

/** The tournaments: the samples above until the backend has them. */
export const tournamentsService = {
  list: (now = new Date()): Tournament[] => sampleTournaments(now),
};
