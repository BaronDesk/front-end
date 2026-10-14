import type { MatchStatus, Tournament, TournamentMatch, TournamentTeam } from '../core/api-types';

/*
 * Sample tournaments, shown until the backend has GET /tournaments. Dates
 * are relative to today, so the samples stay current. Covers are left empty:
 * the page shows the game's poster from the catalog instead. Creating or
 * joining a team changes the samples in memory only (a reload starts over).
 * In member lists, ME stands for the signed-in gamer (useTournaments puts
 * their username in).
 */

export const ME = '@me';

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

/** Teams named as given; each gets `members` (a count or the usernames) and a join PIN. */
function teams(prefix: string, list: [name: string, members: number | string[], code?: string][], size: number): TournamentTeam[] {
  return list.map(([name, members, code], i) => ({
    id: `${prefix}-${i + 1}`,
    name,
    seed: i + 1,
    members: Array.isArray(members)
      ? members
      : size === 1
        ? [name]
        : Array.from({ length: members }, (_, k) => `${name.split(' ')[0].toLowerCase()}.${k + 1}`),
    joinCode: size === 1 ? null : (code ?? String(100_000 + ((i + 1) * 7_919 * prefix.length) % 900_000)),
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
  const unseeded = (list: TournamentTeam[]) => list.map((t) => ({ ...t, seed: null }));
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
      prizePoolCoins: 50_000,
      matchMinutes: 60,
      registrationClosesAt: dayAt(now, -2, 23, 59),
      startsAt: riftStart,
      teams: teams(
        'rm',
        [
          ['Baron Wolves', ['nour.mid', ME, 'yassine.adc', 'mehdi.jgl', 'lina.sup'], '481565'],
          ['Lac Legends', 5],
          ['Night Owls', 5],
          ['Pixel Pirates', 5],
          ['Red Rift', 5],
          ['Carthage Kings', 5],
          ['Sidi Snipers', 5],
          ['Byrsa Bears', 5],
        ],
        5,
      ),
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
      myNextMatch: { matchId: 'rm-m2-1', machineName: 'PC-03', pin: '986784' },
    },
    {
      id: 'summoner-showdown',
      name: 'Summoner Showdown',
      coverUrl: null,
      game: { id: 'league-of-legends', name: 'League of Legends', iconUrl: null },
      branch: EL_MANAR,
      format: 'SINGLE_ELIMINATION',
      status: 'REGISTRATION_OPEN',
      teamSize: 5,
      maxTeams: 16,
      entryFeeCoins: 10_000,
      prizePoolCoins: 50_000,
      matchMinutes: 60,
      registrationClosesAt: dayAt(now, 2, 23, 59),
      startsAt: dayAt(now, 3, 18),
      teams: unseeded(
        teams(
          'ss',
          [
            ['Desert Foxes', 5],
            ['Medina Mages', 4],
            ['Gold Guardians', 5],
            ['Sidi Snipers', 3, '246810'],
            ['Byrsa Bears', 5],
            ['Tunis Titans', 2],
            ['Lac Lions', 5],
            ['Carthage Kings', 4],
            ['Pixel Pirates', 5],
            ['Night Owls', 5],
          ],
          5,
        ),
      ),
      matches: [],
      myTeamId: null,
      myNextMatch: null,
    },
    {
      id: 'crafters-clash',
      name: 'Crafters Clash',
      coverUrl: null,
      game: { id: 'minecraft', name: 'Minecraft', iconUrl: null },
      branch: LAC_2,
      format: 'SINGLE_ELIMINATION',
      status: 'REGISTRATION_OPEN',
      teamSize: 2,
      maxTeams: 8,
      entryFeeCoins: 4_000,
      prizePoolCoins: 20_000,
      matchMinutes: 45,
      registrationClosesAt: dayAt(now, 4, 23, 59),
      startsAt: dayAt(now, 5, 16),
      // The gamer leads a team with a teammate in it: the leader's menu has someone to act on.
      teams: unseeded(
        teams(
          'cc',
          [
            ['Baron Builders', [ME, 'nour.mc'], '615243'],
            ['Creeper Crew', 2],
            ['Redstone Duo', 1],
            ['Ender Pair', 2],
            ['Block Party', 2],
            ['Lava Lords', 1],
          ],
          2,
        ),
      ),
      matches: [],
      myTeamId: 'cc-1',
      myNextMatch: null,
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
      prizePoolCoins: 15_000,
      matchMinutes: 20,
      registrationClosesAt: dayAt(now, 3, 23, 59),
      startsAt: dayAt(now, 4, 18),
      teams: unseeded(teams('bc', [['ShadowKick', 1], ['Nour', 1], ['Yassine', 1], ['Mehdi', 1], ['Lina', 1]], 1)),
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
      prizePoolCoins: 8_000,
      matchMinutes: 45,
      registrationClosesAt: dayAt(now, -1, 23, 59),
      startsAt: jamStart,
      teams: teams(
        'bj',
        [
          ['Creeper Crew', 2],
          ['Redstone Duo', 2],
          ['Diamond Diggers', 2],
          ['Ender Pair', 2],
          ['Nether Nomads', 2],
          ['Block Party', 2],
          ['Pixel Smiths', 2],
          ['Lava Lords', 2],
        ],
        2,
      ),
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
      prizePoolCoins: 6_000,
      matchMinutes: 20,
      registrationClosesAt: dayAt(now, -7, 23, 59),
      startsAt: dayAt(now, -6, 19),
      teams: teams('bn', [['ShadowKick', 1], ['Aziz', 1], ['Mariem', 1], ['Omar', 1], ['Sami', 1], ['Ines', 1], ['Karim', 1], ['Hedi', 1]], 1),
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

// ---------- The in-memory store (until the backend keeps tournaments) ----------

let state: Tournament[] | null = null;
const listeners = new Set<() => void>();

function current(): Tournament[] {
  state ??= sampleTournaments();
  return state;
}

/** Applies `change` to one tournament, after `check` says it may (it throws the refusal). */
function update(id: string, change: (t: Tournament) => Tournament): Promise<Tournament> {
  const t = current().find((x) => x.id === id);
  if (!t) return Promise.reject(new Error('This tournament does not exist (any more).'));
  try {
    const next = change(t);
    state = current().map((x) => (x.id === id ? next : x));
    listeners.forEach((l) => l());
    return Promise.resolve(next);
  } catch (err) {
    return Promise.reject(err);
  }
}

function assertCanSignUp(t: Tournament) {
  if (t.status !== 'REGISTRATION_OPEN') throw new Error('Sign-up is closed for this tournament.');
  if (t.myTeamId) throw new Error('You are already in a team here.');
}

function newCode(t: Tournament): string {
  let code: string;
  do code = String(100_000 + Math.floor(Math.random() * 900_000));
  while (t.teams.some((team) => team.joinCode === code));
  return code;
}

/** The tournaments, and what a gamer does in them: sample data until the backend has them. */
export const tournamentsService = {
  list: (): Tournament[] => current(),
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** A new team, with the caller as its captain; solo play: the caller signs up alone, under their name. */
  createTeam: (id: string, name: string) =>
    update(id, (t) => {
      assertCanSignUp(t);
      const teamName = t.teamSize === 1 ? ME : name.trim();
      if (t.teams.length >= t.maxTeams) throw new Error('This tournament is full.');
      if (t.teamSize > 1 && (teamName.length < 2 || teamName.length > 24)) throw new Error('A team name has 2 to 24 characters.');
      if (t.teams.some((team) => team.name.toLowerCase() === teamName.toLowerCase())) throw new Error('A team already has this name.');
      const team: TournamentTeam = { id: `${t.id}-mine`, name: teamName, seed: null, members: [ME], joinCode: t.teamSize === 1 ? null : newCode(t) };
      return { ...t, teams: [...t.teams, team], myTeamId: team.id };
    }),

  /** Joins the team whose captain shared this PIN. */
  joinTeam: (id: string, code: string) =>
    update(id, (t) => {
      assertCanSignUp(t);
      const team = t.teams.find((x) => x.joinCode && x.joinCode === code.trim());
      if (!team) throw new Error('No team has this PIN.');
      if (team.members.length >= t.teamSize) throw new Error(`${team.name} is full.`);
      return { ...t, teams: t.teams.map((x) => (x.id === team.id ? { ...x, members: [...x.members, ME] } : x)), myTeamId: team.id };
    }),

  /** A player (not the leader) leaves their team. */
  leaveTeam: (id: string) =>
    update(id, (t) => {
      const mine = myTeam(t);
      if (mine.members[0] === ME) throw new Error('As the team leader, give the lead to a teammate first, or delete the team.');
      return withTeam(t, { ...mine, members: mine.members.filter((m) => m !== ME) }, null);
    }),

  /** The leader hands the lead to a teammate (they come first in the team). */
  changeLeader: (id: string, member: string) =>
    update(id, (t) => {
      const mine = myLedTeam(t);
      if (member === ME || !mine.members.includes(member)) throw new Error(`${member} is not in your team.`);
      return withTeam(t, { ...mine, members: [member, ...mine.members.filter((m) => m !== member)] });
    }),

  /** The leader takes a player off the team. */
  removeMember: (id: string, member: string) =>
    update(id, (t) => {
      const mine = myLedTeam(t);
      if (member === ME) throw new Error('You lead this team: delete it instead.');
      return withTeam(t, { ...mine, members: mine.members.filter((m) => m !== member) });
    }),

  /** The leader gets a new team PIN: the old one no longer lets anyone join. */
  regenerateCode: (id: string) =>
    update(id, (t) => {
      const mine = myLedTeam(t);
      if (!mine.joinCode) throw new Error('A solo entry has no team PIN.');
      return withTeam(t, { ...mine, joinCode: newCode(t) });
    }),

  /** The leader deletes the team: every player in it is out of the tournament. */
  deleteTeam: (id: string) =>
    update(id, (t) => {
      const mine = myLedTeam(t);
      return { ...t, teams: t.teams.filter((x) => x.id !== mine.id), myTeamId: null };
    }),
};

/** The caller's team, while sign-up is open (teams change only then). */
function myTeam(t: Tournament): TournamentTeam {
  const mine = t.teams.find((x) => x.id === t.myTeamId);
  if (!mine) throw new Error('You are not in a team here.');
  if (t.status !== 'REGISTRATION_OPEN') throw new Error('Teams can only change while sign-up is open.');
  return mine;
}

/** The caller's team, when they lead it. */
function myLedTeam(t: Tournament): TournamentTeam {
  const mine = myTeam(t);
  if (mine.members[0] !== ME) throw new Error('Only the team leader can do this.');
  return mine;
}

/** The tournament with `team` changed (and the caller's team, when given). */
function withTeam(t: Tournament, team: TournamentTeam, myTeamId: string | null = t.myTeamId): Tournament {
  return { ...t, teams: t.teams.map((x) => (x.id === team.id ? team : x)), myTeamId };
}
