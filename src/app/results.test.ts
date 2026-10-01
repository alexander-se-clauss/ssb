import { describe, expect, it } from 'vitest';
import { createMatch, DEFAULT_RULES, type MatchState } from '../core';
import { resultHeading, resultRows } from './results';

const finished = (winner: number | null): MatchState => {
  const state = createMatch({
    stageId: 'battlefield',
    players: [{ characterId: 'capsule' }, { characterId: 'capsule' }],
    rules: DEFAULT_RULES,
  });
  return {
    ...state,
    phase: 'finished',
    winner,
    fighters: state.fighters.map((f) =>
      f.slot === 0
        ? { ...f, kos: 1, falls: 3, damageDealt: 57.4 }
        : { ...f, kos: 3, falls: 1, damageDealt: 120 },
    ),
  };
};

describe('results screen', () => {
  it('names the winner, or a draw', () => {
    expect(resultHeading(finished(1))).toBe('Player 2 wins!');
    expect(resultHeading(finished(null))).toBe('Draw');
  });

  it('lists each player with character, KOs, falls and damage dealt', () => {
    expect(resultRows(finished(1))).toEqual([
      { player: 'P1', character: 'Capsule', kos: 1, falls: 3, damageDealt: 57, winner: false },
      { player: 'P2', character: 'Capsule', kos: 3, falls: 1, damageDealt: 120, winner: true },
    ]);
  });
});
