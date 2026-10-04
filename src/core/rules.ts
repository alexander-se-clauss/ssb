import { TICK_RATE } from './config';
import type { FighterState, MatchState, PlayerSlot } from './types';

/** Time-mode score, as in Smash: KOs minus falls. */
export const score = (fighter: FighterState): number => fighter.kos - fighter.falls;

/** Frames played since GO; 0 during the countdown. */
export const playedFrames = (state: MatchState): number => Math.max(0, state.frame - state.goFrame);

/** Frames until time runs out, or null in a stock match or in training. The clock starts at GO. */
export const timeLeftFrames = (state: MatchState): number | null =>
  state.rules.mode === 'time' && !state.training
    ? Math.max(0, state.rules.timeLimitSeconds * TICK_RATE - playedFrames(state))
    : null;

/** The one fighter with the best score, or null when the best score is shared (a draw). */
export const leader = (fighters: readonly FighterState[]): PlayerSlot | null => {
  const best = Math.max(...fighters.map(score));
  const leaders = fighters.filter((f) => score(f) === best);
  return leaders.length === 1 ? (leaders[0]?.slot ?? null) : null;
};
