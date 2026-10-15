import { beforeEach, describe, expect, it, vi } from 'vitest';

// The samples live in memory: a fresh copy of the module for each test.
let service: typeof import('./tournaments.service');
beforeEach(async () => {
  vi.resetModules();
  service = await import('./tournaments.service');
});

const get = (id: string) => service.tournamentsService.list().find((t) => t.id === id)!;

describe('tournaments (sample data)', () => {
  it('creates a team with the gamer as captain and a fresh 6-digit PIN, and tells the page', async () => {
    const changed = vi.fn();
    service.tournamentsService.subscribe(changed);
    const t = await service.tournamentsService.createTeam('summoner-showdown', '  Baron Wolves ');
    const mine = t.teams.find((x) => x.id === t.myTeamId)!;
    expect(mine).toMatchObject({ name: 'Baron Wolves', members: [service.ME] });
    expect(mine.joinCode).toMatch(/^\d{6}$/);
    expect(changed).toHaveBeenCalled();
    expect(get('summoner-showdown').myTeamId).toBe(mine.id);
  });

  it('refuses a taken name, a second team, and a tournament not open', async () => {
    await expect(service.tournamentsService.createTeam('summoner-showdown', 'night owls')).rejects.toThrow('A team already has this name.');
    await service.tournamentsService.createTeam('summoner-showdown', 'Wolves');
    await expect(service.tournamentsService.createTeam('summoner-showdown', 'Other')).rejects.toThrow('already in a team');
    await expect(service.tournamentsService.createTeam('block-builders-jam', 'Late')).rejects.toThrow('Sign-up is closed');
  });

  it('signs a solo player up under their own name, without a PIN', async () => {
    const t = await service.tournamentsService.createTeam('baron-brawl-cup', '');
    expect(t.teams.find((x) => x.id === t.myTeamId)).toMatchObject({ name: service.ME, joinCode: null });
  });

  it("joins the team whose PIN is typed, and refuses an unknown PIN", async () => {
    await expect(service.tournamentsService.joinTeam('summoner-showdown', '000000')).rejects.toThrow('No team has this PIN.');
    const t = await service.tournamentsService.joinTeam('summoner-showdown', '246810');
    expect(t.teams.find((x) => x.id === t.myTeamId)).toMatchObject({ name: 'Sidi Snipers', members: ['sidi.1', 'sidi.2', 'sidi.3', service.ME] });
  });

  it('lets a player leave, but not their leader, and keeps leader moves for the leader', async () => {
    await service.tournamentsService.joinTeam('summoner-showdown', '246810');
    await expect(service.tournamentsService.removeMember('summoner-showdown', 'sidi.2')).rejects.toThrow('Only the team leader');
    const t = await service.tournamentsService.leaveTeam('summoner-showdown');
    expect(t.myTeamId).toBeNull();
    expect(t.teams.find((x) => x.name === 'Sidi Snipers')?.members).toEqual(['sidi.1', 'sidi.2', 'sidi.3']);

    await service.tournamentsService.createTeam('summoner-showdown', 'Wolves');
    await expect(service.tournamentsService.leaveTeam('summoner-showdown')).rejects.toThrow('give the lead to a teammate first');
  });

  it('lets the leader hand the lead over, get a new team PIN, and delete the team', async () => {
    // No sample team is led by the gamer with teammates in it: join Sidi Snipers, then put the gamer first (its leader).
    await service.tournamentsService.joinTeam('summoner-showdown', '246810');
    const id = 'summoner-showdown';
    const lead = (t = get(id)) => t.teams.find((x) => x.id === t.myTeamId)!.members[0];
    const sidi = get(id).teams.find((x) => x.name === 'Sidi Snipers')!;
    sidi.members.unshift(...sidi.members.splice(sidi.members.indexOf(service.ME), 1));
    expect(lead()).toBe(service.ME);

    let t = await service.tournamentsService.changeLeader(id, 'sidi.2');
    expect(lead(t)).toBe('sidi.2');
    await expect(service.tournamentsService.changeLeader(id, 'sidi.3')).rejects.toThrow('Only the team leader');

    await service.tournamentsService.leaveTeam(id);
    const wolves = await service.tournamentsService.createTeam(id, 'Wolves');
    const oldCode = wolves.teams.find((x) => x.id === wolves.myTeamId)!.joinCode!;
    t = await service.tournamentsService.regenerateCode(id);
    const newCode = t.teams.find((x) => x.id === t.myTeamId)!.joinCode!;
    expect(newCode).toMatch(/^\d{6}$/);
    expect(newCode).not.toBe(oldCode);
    await expect(service.tournamentsService.changeLeader(id, 'nobody')).rejects.toThrow('nobody is not in your team');
    t = await service.tournamentsService.deleteTeam(id);
    expect(t.myTeamId).toBeNull();
    expect(t.teams.some((x) => x.name === 'Wolves')).toBe(false);
  });
});

describe('tournaments at the desk (sample data)', () => {
  const input = {
    name: 'Desk Cup',
    coverUrl: null,
    game: { id: 'g', name: 'Brawlhalla' },
    branch: { id: 'b', name: 'CENTRE El Manar' },
    teamSize: 1,
    maxTeams: 4,
    entryFeeCoins: 0,
    prizePoolCoins: 5000,
    matchMinutes: 20,
    registrationClosesAt: '2026-10-20T10:00:00.000Z',
    startsAt: '2026-10-20T16:00:00.000Z',
  };

  it('creates a tournament open for sign-up, and refuses one that starts before sign-up closes', async () => {
    const t = await service.tournamentsService.createTournament(input);
    expect(t).toMatchObject({ name: 'Desk Cup', status: 'REGISTRATION_OPEN', teams: [], format: 'SINGLE_ELIMINATION' });
    expect(service.tournamentsService.list()[0].id).toBe(t.id);
    await expect(service.tournamentsService.createTournament({ ...input, startsAt: '2026-10-19T10:00:00.000Z' })).rejects.toThrow('Sign-up must close before');
  });

  it('runs it: close sign-up, draw, start, results until the final ends it', async () => {
    const id = 'baron-brawl-cup'; // 5 players signed up
    await expect(service.tournamentsService.drawBracket(id)).rejects.toThrow('Close sign-up before');
    await service.tournamentsService.setStage(id, 'close');
    let t = await service.tournamentsService.drawBracket(id);
    expect(t.matches).toHaveLength(7);
    await expect(service.tournamentsService.updateTournament(id, { ...input, maxTeams: 8 })).rejects.toThrow('before its bracket is drawn');
    await expect(service.tournamentsService.removeTeam(id, t.teams[0].id)).rejects.toThrow('can no longer change');
    await expect(service.tournamentsService.reportResult(id, t.matches[0].id, 1, 0)).rejects.toThrow('Start the tournament');
    await service.tournamentsService.setStage(id, 'start');
    const toPlay = () => get(id).matches.filter((m) => m.teamAId && m.teamBId && m.status === 'READY');
    while (toPlay().length) t = await service.tournamentsService.reportResult(id, toPlay()[0].id, 2, 1);
    expect(t.status).toBe('COMPLETED');
  });

  it('edits before the draw (never fewer places than teams in), removes a team, and deletes', async () => {
    const id = 'summoner-showdown'; // 10 teams in
    await expect(service.tournamentsService.updateTournament(id, { ...input, teamSize: 5, maxTeams: 8 })).rejects.toThrow('10 teams are already in');
    const t = await service.tournamentsService.updateTournament(id, { ...input, name: 'Showdown', teamSize: 5, maxTeams: 12 });
    expect(t).toMatchObject({ name: 'Showdown', maxTeams: 12 });
    expect((await service.tournamentsService.removeTeam(id, t.teams[0].id)).teams).toHaveLength(9);
    await service.tournamentsService.deleteTournament(id);
    expect(get(id)).toBeUndefined();
  });
});
