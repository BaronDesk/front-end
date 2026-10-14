import { describe, expect, it } from 'vitest';

import type { Tournament, TournamentMatch } from '../core/api-types';
import { champion, coverOf, filterTournaments, formatText, matchesByRound, nextMatchOf, placesText, roundCount, roundName } from './tournaments';

const match = (round: number, position: number, over: Partial<TournamentMatch> = {}): TournamentMatch => ({
  id: `m${round}-${position}`,
  round,
  position,
  teamAId: null,
  teamBId: null,
  winnerTeamId: null,
  scoreA: null,
  scoreB: null,
  status: 'PENDING',
  scheduledAt: null,
  ...over,
});

const cup = (over: Partial<Tournament> = {}): Tournament => ({
  id: 't1',
  name: 'Cup',
  coverUrl: null,
  game: { id: 'g1', name: 'Brawlhalla', iconUrl: '/uploads/images/brawl.webp' },
  branch: { id: 'b1', name: 'El Manar' },
  format: 'SINGLE_ELIMINATION',
  status: 'IN_PROGRESS',
  teamSize: 1,
  maxTeams: 4,
  entryFeeCoins: 0,
  matchMinutes: 20,
  registrationClosesAt: '2026-10-01T00:00:00Z',
  startsAt: '2026-10-02T00:00:00Z',
  teams: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), seed: null, members: [id] })),
  matches: [match(2, 1, { teamAId: 'a', teamBId: 'c' }), match(1, 2, { teamAId: 'c', teamBId: 'd', winnerTeamId: 'c', status: 'COMPLETED' }), match(1, 1, { teamAId: 'a', teamBId: 'b', winnerTeamId: 'a', status: 'COMPLETED' })],
  myTeamId: 'a',
  myNextMatch: { matchId: 'm2-1', machineName: 'PC-03', pin: '482913' },
  ...over,
});

describe('tournaments', () => {
  it('names the rounds from the end: final, semi-finals, quarter-finals, then by number', () => {
    expect([1, 2, 3, 4].map((r) => roundName(r, 4))).toEqual(['Round 1', 'Quarter-finals', 'Semi-finals', 'Final']);
    expect(roundCount(cup())).toBe(2);
    expect(roundCount(cup({ matches: [], maxTeams: 8 }))).toBe(3);
  });

  it('lists the bracket round by round, top to bottom', () => {
    expect(matchesByRound(cup()).map((r) => r.map((m) => m.id))).toEqual([['m1-1', 'm1-2'], ['m2-1']]);
  });

  it('words the format and the places, solo or in teams', () => {
    expect(formatText(cup())).toBe('1v1 · Single elimination');
    expect(placesText(cup())).toBe('4 / 4 players');
    expect(placesText(cup({ teamSize: 5, maxTeams: 8 }))).toBe('4 / 8 teams');
  });

  it("shows the uploaded cover, else the game's poster", () => {
    expect(coverOf(cup())).toBe('/uploads/images/brawl.webp');
    expect(coverOf(cup({ coverUrl: '/uploads/images/cover.webp' }))).toBe('/uploads/images/cover.webp');
  });

  it('gives the champion only once the final is played, and the next match against the other side', () => {
    expect(champion(cup())).toBeNull();
    const done = cup({ matches: cup().matches.map((m) => (m.round === 2 ? { ...m, winnerTeamId: 'c', status: 'COMPLETED' as const } : m)) });
    expect(champion(done)?.name).toBe('C');
    expect(nextMatchOf(cup())).toMatchObject({ round: 'Final', team: { name: 'A' }, opponent: { name: 'C' }, machineName: 'PC-03' });
  });

  it('filters by the chip: open, upcoming, live, finished', () => {
    const list = [cup({ id: 'open', status: 'REGISTRATION_OPEN' }), cup({ id: 'live' }), cup({ id: 'done', status: 'COMPLETED' })];
    expect(filterTournaments(list, 'all')).toHaveLength(3);
    expect(filterTournaments(list, 'live').map((t) => t.id)).toEqual(['live']);
    expect(filterTournaments(list, 'finished').map((t) => t.id)).toEqual(['done']);
  });
});
