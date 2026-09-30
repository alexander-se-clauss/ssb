import { inputOf } from './input';
import { createMatch, step } from './simulation';
import { BATTLEFIELD } from './stages';
import { CAPSULE } from './registry';
import { DEFAULT_RULES } from './config';
import type { FighterState, MatchRules, MatchState, PlayerInput } from './types';

export const newMatch = (playerCount = 2, rules: MatchRules = DEFAULT_RULES): MatchState =>
  createMatch({
    stageId: BATTLEFIELD.id,
    players: Array.from({ length: playerCount }, () => ({ characterId: CAPSULE.id })),
    rules,
  });

/** Runs `frames` steps with the given inputs held the whole time. */
export const run = (
  state: MatchState,
  frames: number,
  inputs: readonly PlayerInput[] = [],
): MatchState => {
  let next = state;
  for (let i = 0; i < frames; i += 1) next = step(next, inputs);
  return next;
};

/** Lets every fighter fall and settle on the stage. */
export const settled = (state: MatchState = newMatch()): MatchState => run(state, 120);

export const fighter = (state: MatchState, slot: number): FighterState => {
  const found = state.fighters[slot];
  if (!found) throw new Error(`No fighter in slot ${slot}`);
  return found;
};

/** Replaces fields of one fighter, for setting up a scenario. */
export const withFighter = (
  state: MatchState,
  slot: number,
  patch: Partial<FighterState>,
): MatchState => ({
  ...state,
  fighters: state.fighters.map((f) => (f.slot === slot ? { ...f, ...patch } : f)),
});

export { inputOf };
