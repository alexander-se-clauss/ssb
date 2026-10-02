import { DODGE, type FighterState } from '../../core';

/** How far a sidestep moves the body out of the stage plane, in stage units. */
export const DODGE_DEPTH = 0.9;
/** Height above the feet of the point a rolling body turns around. */
export const ROLL_PIVOT = 0.45;

const TURN = 2 * Math.PI;

/** How the view moves a dodging body beyond its 2D pose: all in radians and stage units. */
export interface DodgeMotion {
  /** Out of the stage plane; towards the camera is positive. */
  readonly depth: number;
  /** Turn in the stage plane around `ROLL_PIVOT`, counter-clockwise positive. */
  readonly spin: number;
  /** Turn around the vertical axis. */
  readonly yaw: number;
}

const STILL: DodgeMotion = { depth: 0, spin: 0, yaw: 0 };
const progress = (frame: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (frame - from) / (to - from)));

/**
 * The view-only motion of a dodge, as in Melee: a sidestep steps into the background (or
 * towards the camera) and back, a roll somersaults along the stage the way it travels, and an air
 * dodge spins round once. Sidestep and air dodge are done by the last invulnerable frame, so a
 * fighter that can be hit looks it. The game stays on its 2D plane.
 */
export const dodgeMotion = (
  fighter: Pick<FighterState, 'action' | 'actionFrame' | 'facing'>,
): DodgeMotion => {
  const frame = fighter.actionFrame;
  switch (fighter.action) {
    case 'sidestepIn':
    case 'sidestepOut': {
      const back = DODGE.sidestep.invulnerableTo - 1;
      if (frame >= back) return STILL;
      const side = fighter.action === 'sidestepIn' ? -1 : 1;
      return { ...STILL, depth: side * DODGE_DEPTH * Math.sin(Math.PI * progress(frame, 0, back)) };
    }
    case 'forwardRoll':
    case 'backRoll': {
      const travel = fighter.action === 'forwardRoll' ? fighter.facing : -fighter.facing;
      const { moveFrom, moveTo } = DODGE.roll;
      return { ...STILL, spin: -travel * TURN * progress(frame, moveFrom, moveTo) };
    }
    case 'airDodge':
      return { ...STILL, yaw: TURN * progress(frame, 0, DODGE.air.invulnerableTo - 1) };
    default:
      return STILL;
  }
};

/** From one angle `t` (0..1) of the way to another, the short way round. */
export const lerpAngle = (from: number, to: number, t: number): number => {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * t;
};
