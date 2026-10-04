/**
 * Melee-style ground movement (#146). A slowly pushed stick walks; a sideways flick dashes for the
 * fighter's `initialDashFrames`, and a flick back during the dash dashes the other way (dash
 * dance), or, on the dash's first frame, turns in place (pivot). Held past the dash, the fighter
 * runs; letting go skids to a stop, pushing back brakes and turns round (run turnaround).
 *
 * Only the movement itself: jumps, attacks and dodges start out of any of these states in
 * `fighter.ts` before this runs.
 */
import { flickedThisFrame, type StickTracker } from './attack-input';
import { STICK } from './config';
import { approach } from './math';
import type { CharacterStats, FighterAction, PlayerInput } from './types';

const GROUND_ACTIONS = [
  'idle',
  'walk',
  'dash',
  'run',
  'skid',
  'runTurn',
] as const satisfies readonly FighterAction[];

export type GroundAction = (typeof GROUND_ACTIONS)[number];

export const isGroundMovement = (action: FighterAction): action is GroundAction =>
  (GROUND_ACTIONS as readonly FighterAction[]).includes(action);

/** What ground movement changes about a fighter in one frame. */
export interface GroundMotion {
  readonly action: GroundAction;
  /** Frames in the action before this one: 0 on the frame it starts, 1 on the next. */
  readonly actionFrame: number;
  readonly facing: 1 | -1;
  /** Horizontal speed. */
  readonly vx: number;
}

/** A stick past this sideways turns a standing or walking fighter round. */
const FACE_THRESHOLD = 0.2;
const MOVE_EPSILON = 0.001;

/** Advances a grounded fighter's movement by one frame. */
export const moveOnGround = (
  now: GroundMotion,
  input: PlayerInput,
  stick: StickTracker,
  stats: CharacterStats,
): GroundMotion => {
  const { action, actionFrame, facing, vx } = now;
  const side = stick.direction === 'right' ? 1 : stick.direction === 'left' ? -1 : 0;
  // A flick to the rim this very frame, the same one that would make a smash.
  const flick = side !== 0 && flickedThisFrame(stick);
  const holds = (way: 1 | -1): boolean => side === way && Math.abs(input.x) >= STICK.run;
  const back = facing === 1 ? -1 : 1;
  // A skid or a turnaround brakes from full run speed to a halt over `skidFrames`.
  const braked = approach(vx, 0, stats.runSpeed / stats.skidFrames);
  const dash = (way: 1 | -1): GroundMotion => ({
    action: 'dash',
    actionFrame: 0,
    facing: way,
    vx: way * stats.dashSpeed,
  });
  const into = (next: GroundAction, way: 1 | -1, speed: number): GroundMotion => ({
    action: next,
    actionFrame: next === action ? actionFrame : 0,
    facing: way,
    vx: speed,
  });

  switch (action) {
    case 'dash':
      if (flick && side === back) {
        // Back on the frame after the dash started turns in place, so a tilt or smash faces the other way.
        return actionFrame === 1 ? into('idle', back, 0) : dash(back);
      }
      if (actionFrame >= stats.initialDashFrames) {
        // A dash let go of ends on the spot, without sliding on in the standing pose.
        return holds(facing) ? into('run', facing, vx) : into('idle', facing, 0);
      }
      return into('dash', facing, facing * stats.dashSpeed);
    case 'run':
      if (holds(back)) return into('runTurn', facing, braked);
      if (!holds(facing)) return into('skid', facing, braked);
      return into('run', facing, approach(vx, facing * stats.runSpeed, stats.groundAcceleration));
    case 'skid':
      return actionFrame >= stats.skidFrames
        ? into('idle', facing, braked)
        : into('skid', facing, braked);
    case 'runTurn':
      // Turned round once braked: running on the other way if the stick still holds it.
      if (actionFrame >= stats.skidFrames) return into(holds(back) ? 'run' : 'idle', back, braked);
      return into('runTurn', facing, braked);
    case 'idle':
    case 'walk': {
      if (flick) return dash(side === 1 ? 1 : -1);
      const stickWay = input.x > 0 ? 1 : -1;
      const way = Math.abs(input.x) > FACE_THRESHOLD ? stickWay : facing;
      const speed = approach(vx, input.x * stats.walkSpeed, stats.groundAcceleration);
      const walking = Math.abs(input.x) >= STICK.deadzone && Math.abs(speed) > MOVE_EPSILON;
      return into(walking ? 'walk' : 'idle', way, speed);
    }
  }
};
