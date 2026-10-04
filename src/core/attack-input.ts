/**
 * Reads attack intent from the stick: which way an attack goes and whether it is a tilt or a
 * smash. A smash is a quick flick from the centre to the rim, as in Melee; pushing the stick
 * slowly, or holding it, gives a tilt. The tracker is plain data, so a fighter can carry it in
 * the match state and the move engine can read it when attack is pressed.
 */
import { STICK } from './config';
import type { PlayerInput } from './types';

/** Stick deflection below the deadzone counts as centred. */
export const applyDeadzone = (value: number): number =>
  Math.abs(value) < STICK.deadzone ? 0 : value;

/** Where the stick points on screen, along its stronger axis. */
export type StickDirection = 'none' | 'left' | 'right' | 'up' | 'down';

export interface StickTracker {
  readonly direction: StickDirection;
  /** Deflection along that axis, 0..1. */
  readonly deflection: number;
  /** Frames the stick has been out of the deadzone, this one included; 0 while centred. */
  readonly framesOut: number;
  /** Frames a flick still counts as a smash; 0 when there is none. */
  readonly smashFramesLeft: number;
}

export const CENTRED_STICK: StickTracker = {
  direction: 'none',
  deflection: 0,
  framesOut: 0,
  smashFramesLeft: 0,
};

const directionOf = (x: number, y: number): { direction: StickDirection; deflection: number } => {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (Math.max(ax, ay) < STICK.deadzone) return { direction: 'none', deflection: 0 };
  return ax >= ay
    ? { direction: x > 0 ? 'right' : 'left', deflection: ax }
    : { direction: y > 0 ? 'up' : 'down', deflection: ay };
};

const OPPOSITE: Readonly<Record<StickDirection, StickDirection>> = {
  none: 'none',
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
};

/** Advances the tracker by one frame of input. */
export const trackStick = (tracker: StickTracker, input: PlayerInput): StickTracker => {
  const { direction, deflection } = directionOf(input.x, input.y);
  if (direction === 'none') return CENTRED_STICK;
  // A stick passes the centre on its way to the opposite side; keys can skip it in one frame.
  const before = direction === OPPOSITE[tracker.direction] ? CENTRED_STICK : tracker;
  const framesOut = before.framesOut + 1;
  const reachedRim = deflection >= STICK.smash && before.deflection < STICK.smash;
  const sameDirection = direction === before.direction;
  let smashFramesLeft = 0;
  if (reachedRim && framesOut <= STICK.flickFrames) smashFramesLeft = STICK.smashWindowFrames;
  else if (sameDirection) smashFramesLeft = Math.max(0, before.smashFramesLeft - 1);
  return { direction, deflection, framesOut, smashFramesLeft };
};

/** Whether the stick reached the rim in a flick on this very frame (a smash, or a dash, #146). */
export const flickedThisFrame = (tracker: StickTracker): boolean =>
  tracker.smashFramesLeft === STICK.smashWindowFrames;

export type AttackDirection = 'neutral' | 'forward' | 'back' | 'up' | 'down';
export type AttackStrength = 'tilt' | 'smash';

/** The attack the stick asks for right now, for a fighter facing right (1) or left (-1). */
export const attackInput = (
  tracker: StickTracker,
  facing: 1 | -1,
): { direction: AttackDirection; strength: AttackStrength } => {
  const strength: AttackStrength = tracker.smashFramesLeft > 0 ? 'smash' : 'tilt';
  switch (tracker.direction) {
    case 'none':
      return { direction: 'neutral', strength: 'tilt' };
    case 'up':
    case 'down':
      return { direction: tracker.direction, strength };
    case 'left':
    case 'right':
      return {
        direction: (tracker.direction === 'right') === (facing === 1) ? 'forward' : 'back',
        strength,
      };
  }
};
