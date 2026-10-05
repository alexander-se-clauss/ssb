/**
 * What the training HUD (#144) shows, as plain text from the match state: the combo counter,
 * the last hit's frame advantage, the first player's current (or last) move with its frames, and
 * whether its last aerial landing was L-cancelled (#149), and how stale that move is (#157).
 * Frames are counted from 1, as frame data usually is.
 */
import {
  damageScale,
  findMove,
  moveTiming,
  type AerialLanding,
  type MatchState,
  type MoveDef,
} from '../../core';

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
  /** How the player's last aerial landing went; a dash before the first one. */
  readonly lCancel: string;
  /**
   * How stale the player's current (or last) move is (#157): its copies in the stale queue and
   * the share of its damage its next use deals, like `2× · 84%` or `Fresh · 105%`. A use that
   * just hit is already counted.
   */
  readonly stale: string;
}

const LANDING_LABEL: Readonly<Record<AerialLanding, string>> = {
  lCancelled: 'Yes',
  missed: 'Missed',
  autoCancelled: 'Auto-cancel',
};

/** `forwardSmash` → `Forward smash`, `jab2` → `Jab 2`. */
export const moveName = (id: string): string => {
  const words = id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Startup and active frames: from the hitboxes, or for a move without any from what it does
 * instead: its guard or counter window, or the frame it spawns its object.
 */
export const frameData = (
  move: MoveDef,
): { startupFrames: number; activeFrames: number; totalFrames: number } => {
  const timing = moveTiming(move);
  if (move.hitboxes.length > 0) return timing;
  const window = move.guard ?? move.counter;
  if (window)
    return { ...timing, startupFrames: window.from, activeFrames: window.to - window.from };
  const spawns = (move.spawns ?? []).map((spawn) => spawn.frame);
  if (spawns.length > 0) {
    const first = Math.min(...spawns);
    return { ...timing, startupFrames: first, activeFrames: Math.max(...spawns) - first + 1 };
  }
  return timing;
};

export const phaseOf = (moveId: string, actionFrame: number): MovePhase => {
  const { startupFrames, activeFrames } = frameData(findMove(moveId));
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
  const timing = frameData(findMove(id));
  const frame = playing && player ? player.actionFrame : null;
  return {
    name: moveName(id),
    frame: frame === null ? null : frame + 1,
    // A move that does nothing measurable (no hitbox, guard, counter or spawn) has no phases.
    phase: frame === null || timing.activeFrames === 0 ? null : phaseOf(id, frame),
    active:
      timing.activeFrames > 0
        ? [timing.startupFrames + 1, timing.startupFrames + timing.activeFrames]
        : null,
    total: timing.totalFrames,
  };
};

const lCancelReadout = (state: MatchState, dummy: number): string => {
  const landing = state.fighters.find((f) => f.slot !== dummy)?.lastLanding ?? null;
  return landing === null ? '–' : LANDING_LABEL[landing];
};

const staleReadout = (state: MatchState, dummy: number, lastMove: string | null): string => {
  const player = state.fighters.find((f) => f.slot !== dummy);
  const id = (player?.action === 'attack' ? player.moveId : null) ?? lastMove;
  if (!player || !id) return '–';
  const copies = player.staleMoves.filter((move) => move === id).length;
  const share = `${Math.round(damageScale(player.staleMoves, id) * 100)}%`;
  return `${copies === 0 ? 'Fresh' : `${copies}×`} · ${share}`;
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
    lCancel: lCancelReadout(state, training.settings.dummy),
    stale: staleReadout(state, training.settings.dummy, training.lastMove),
  };
};
