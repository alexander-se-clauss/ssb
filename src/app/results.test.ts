import { describe, expect, it } from 'vitest';
import { createMatch, DEFAULT_RULES, type MatchState } from '../core';
import { resultHeading, resultPlacements } from './results';

const finished = (count: number, winner: number | null): MatchState => ({
  ...createMatch({
    stageId: 'battlefield',
    players: Array.from({ length: count }, () => ({ characterId: 'capsule' })),
    rules: DEFAULT_RULES,
  }),
  phase: 'finished',
  winner,
});

describe('results podium', () => {
  it('names the winner, or a draw', () => {
    expect(resultHeading(finished(2, 1))).toBe('Player 2 wins!');
    expect(resultHeading(finished(2, null))).toBe('Draw');
  });

  it.each([2, 3, 4])('ranks %i stock players by reverse elimination order', (count) => {
    const state = finished(count, count - 1);
    const end = {
      ...state,
      fighters: state.fighters.map((f) => ({ ...f, stocks: f.slot === count - 1 ? 1 : 0 })),
    };
    const placements = resultPlacements(
      end,
      Array.from({ length: count - 1 }, (_, slot) => ({ slot, frame: 100 + slot * 100 })),
    );
    expect(placements.map((p) => p.slot)).toEqual(
      Array.from({ length: count }, (_, i) => count - 1 - i),
    );
    expect(placements.map((p) => p.place)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    expect(placements[0]?.character).toBe('Capsule');
  });

  it('shares placements for simultaneous stock eliminations', () => {
    const state = finished(4, 3);
    const end = {
      ...state,
      fighters: state.fighters.map((f) => ({ ...f, stocks: f.slot === 3 ? 1 : 0 })),
    };
    expect(
      resultPlacements(end, [
        { slot: 0, frame: 10 },
        { slot: 1, frame: 20 },
        { slot: 2, frame: 20 },
      ]).map((p) => p.place),
    ).toEqual([1, 2, 2, 4]);
  });

  it('ranks time matches by KOs minus falls, retaining ties without using damage', () => {
    const state = finished(4, null);
    const end = {
      ...state,
      rules: { ...state.rules, mode: 'time' as const },
      fighters: state.fighters.map((f) => ({
        ...f,
        kos: [1, 4, 3, 2][f.slot] ?? 0,
        falls: [1, 1, 0, 1][f.slot] ?? 0,
        damageDealt: f.slot * 100,
      })),
    };
    const placements = resultPlacements(end);
    expect(placements.map((p) => p.slot)).toEqual([1, 2, 3, 0]);
    expect(placements.map((p) => p.place)).toEqual([1, 1, 3, 4]);
  });
});
