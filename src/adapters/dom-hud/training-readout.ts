/**
 * What the training HUD (#144) shows, as plain text from the match state: the combo counter,
 * the last hit's frame advantage and the first player's current (or last) move with its frames.
 * Frames are counted from 1, as frame data usually is.
 */
import { findMove, moveTiming, type MatchState } from '../../core';

export type MovePhase = 'startup' | 'active' | 'endlag';

export interface MoveReadout {
  readonly name: string;
  /** The frame the move is on, or null once it is over. */
  readonly frame: number | null;
  readonly phase: MovePhase | null;
  /** First and last active frame; null for a move without hitboxes. */
  readonly active: readonly [number, number] | null;
  readonly total: number;
}

export interface TrainingReadout {
  readonly comboHits: number;
  readonly comboDamage: number;
  readonly comboActive: boolean;
  /** Signed, like `+3` or `-9`; a dash before any hit was measured. */
  readonly advantage: string;
  readonly move: MoveReadout | null;
}

/** `forwardSmash` → `Forward smash`, `jab2` → `Jab 2`. */
export const moveName = (id: string): string => {
  const words = id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const phaseOf = (moveId: string, actionFrame: number): MovePhase => {
  const { startupFrames, activeFrames } = moveTiming(findMove(moveId));
  if (actionFrame < startupFrames) return 'startup';
  return actionFrame < startupFrames + activeFrames ? 'active' : 'endlag';
};

const moveReadout = (
  state: MatchState,
  dummy: number,
  lastMove: string | null,
): MoveReadout | null => {
  const player = state.fighters.find((f) => f.slot !== dummy);
  const playing = player?.action === 'attack' ? player.moveId : null;
  const id = playing ?? lastMove;
  if (!id) return null;
  const timing = moveTiming(findMove(id));
  const frame = playing && player ? player.actionFrame : null;
  return {
    name: moveName(id),
    frame: frame === null ? null : frame + 1,
    phase: frame === null ? null : phaseOf(id, frame),
    active:
      timing.activeFrames > 0
        ? [timing.startupFrames + 1, timing.startupFrames + timing.activeFrames]
        : null,
    total: timing.totalFrames,
  };
};

/** The readout for a training match, or null for any other match. */
export const trainingReadout = (state: MatchState): TrainingReadout | null => {
  const training = state.training;
  if (!training) return null;
  const { advantage } = training;
  return {
    comboHits: training.comboHits,
    comboDamage: Math.round(training.comboDamage),
    comboActive: training.comboActive,
    advantage: advantage === null ? '–' : advantage > 0 ? `+${advantage}` : String(advantage),
    move: moveReadout(state, training.settings.dummy, training.lastMove),
  };
};
