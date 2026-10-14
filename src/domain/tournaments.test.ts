import { describe, expect, it } from 'vitest';

import type { Tournament, TournamentMatch } from '../core/api-types';
import {
  branchTag,
  cardAction,
  cardDate,
  champion,
  coverOf,
  filterTournaments,
  matchDate,
  matchesByRound,
  matchRoundName,
  nextMatchOf,
  roundCount,
  roundName,
  startsInText,
  teamCells,
  teamSizeText,
} from './tournaments';

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
  branch: { id: 'b1', name: 'CENTRE El Manar' },
  format: 'SINGLE_ELIMINATION',
  status: 'IN_PROGRESS',
  teamSize: 1,
  maxTeams: 4,
  entryFeeCoins: 0,
  prizePoolCoins: 0,
  matchMinutes: 20,
  registrationClosesAt: '2026-10-01T00:00:00Z',
  startsAt: '2026-10-02T00:00:00Z',
  teams: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), seed: null, members: [id], joinCode: null })),
  matches: [match(2, 1, { teamAId: 'a', teamBId: 'c' }), match(1, 2, { teamAId: 'c', teamBId: 'd', winnerTeamId: 'c', status: 'COMPLETED' }), match(1, 1, { teamAId: 'a', teamBId: 'b', winnerTeamId: 'a', status: 'COMPLETED' })],
  myTeamId: 'a',
  myNextMatch: { matchId: 'm2-1', machineName: 'PC-03', pin: '482913' },
  ...over,
});

describe('tournaments', () => {
  it('names the rounds from the end: final, semi-finals, quarter-finals, then by number', () => {
    expect([1, 2, 3, 4].map((r) => roundName(r, 4))).toEqual(['Round 1', 'Quarter-finals', 'Semi-finals', 'Final']);
    expect([1, 2, 3, 4].map((r) => matchRoundName(r, 4))).toEqual(['Round 1', 'Quarter Final', 'Semi Final', 'Final']);
    expect(roundCount(cup())).toBe(2);
    expect(roundCount(cup({ matches: [], maxTeams: 8 }))).toBe(3);
  });

  it('lists the bracket round by round, top to bottom', () => {
    expect(matchesByRound(cup()).map((r) => r.map((m) => m.id))).toEqual([['m1-1', 'm1-2'], ['m2-1']]);
  });

  it("words a card's tags and dates as the design does", () => {
    expect(teamSizeText(5)).toBe('5/Team');
    expect(teamSizeText(1)).toBe('Solo');
    expect(branchTag('CENTRE El Manar')).toBe('El-Manar');
    expect(cardDate(new Date(2026, 9, 14, 18, 0).toISOString())).toBe('Oct 14-2026-18:00');
    expect(matchDate(new Date(2026, 9, 14, 16, 30).toISOString())).toBe('14 Oct - 16:30');
  });

  it('counts the days to the start by calendar day, and says when it is live or over', () => {
    const now = new Date(2026, 9, 14, 23, 0);
    const at = (d: number, h: number) => new Date(2026, 9, d, h).toISOString();
    expect(startsInText({ status: 'REGISTRATION_OPEN', startsAt: at(17, 18) }, now)).toBe('Starts in 3 Days !');
    expect(startsInText({ status: 'REGISTRATION_OPEN', startsAt: at(15, 1) }, now)).toBe('Starts tomorrow !');
    expect(startsInText({ status: 'REGISTRATION_CLOSED', startsAt: at(14, 23) }, now)).toBe('Starts today !');
    expect(startsInText({ status: 'IN_PROGRESS', startsAt: at(13, 18) }, now)).toBe('Live now !');
    expect(startsInText({ status: 'COMPLETED', startsAt: at(8, 18) }, now)).toBe('Finished');
  });

  it("offers joining an open tournament, the gamer's team once in one, the results once over", () => {
    expect(cardAction({ status: 'REGISTRATION_OPEN', myTeamId: null })).toBe('Join Tournament');
    expect(cardAction({ status: 'IN_PROGRESS', myTeamId: 'a' })).toBe('My Team');
    expect(cardAction({ status: 'IN_PROGRESS', myTeamId: null })).toBe('Follow Live');
    expect(cardAction({ status: 'REGISTRATION_CLOSED', myTeamId: null })).toBe('View Tournament');
    expect(cardAction({ status: 'COMPLETED', myTeamId: 'a' })).toBe('View Results');
  });

  it('puts the members in the middle cells, the captain in the center of them', () => {
    expect(teamCells(5, ['cap', 'b', 'c'])).toEqual([null, 'b', 'cap', 'c', null]);
    expect(teamCells(5, ['cap'])).toEqual([null, null, 'cap', null, null]);
    expect(teamCells(2, ['cap', 'b'])).toEqual(['b', 'cap']);
    expect(teamCells(3, [])).toEqual([null, null, null]);
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
