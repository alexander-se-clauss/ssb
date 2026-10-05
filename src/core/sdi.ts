/**
 * Smash DI (#155), as in Melee: during hitlag, each fresh flick of the stick from the centre to
 * past `SDI.threshold` moves the hit fighter `SDI.distance` that way. A fighter standing on a
 * platform is never pushed down through it.
 */
import { SDI, STICK } from './config';
import type { Vec2 } from './math';
import type { PlayerInput, StageDef } from './types';

/** Whether this frame's stick is a fresh flick: centred last frame, past the threshold now. */
export const isSdiFlick = (input: PlayerInput, previous: PlayerInput): boolean =>
  Math.hypot(previous.x, previous.y) < STICK.deadzone &&
  Math.hypot(input.x, input.y) >= SDI.threshold;

/** Where a fighter at `position` ends up after an SDI flick of `input` on `stage`. */
export const smashDi = (position: Vec2, input: PlayerInput, stage: StageDef): Vec2 => {
  const length = Math.hypot(input.x, input.y);
  const x = position.x + (input.x / length) * SDI.distance;
  let y = position.y + (input.y / length) * SDI.distance;
  // Not down through a platform it stands on or above.
  for (const { bounds } of stage.platforms) {
    const over = x >= bounds.left && x <= bounds.right;
    if (over && position.y >= bounds.top && y < bounds.top) y = bounds.top;
  }
  return { x, y };
};
