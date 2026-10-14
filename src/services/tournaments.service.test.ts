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

  it('lets the leader hand the lead over, take a player off, and delete the team', async () => {
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
    await service.tournamentsService.createTeam(id, 'Wolves');
    await expect(service.tournamentsService.changeLeader(id, 'nobody')).rejects.toThrow('nobody is not in your team');
    t = await service.tournamentsService.deleteTeam(id);
    expect(t.myTeamId).toBeNull();
    expect(t.teams.some((x) => x.name === 'Wolves')).toBe(false);
  });
});
