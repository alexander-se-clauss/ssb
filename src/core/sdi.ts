/**
 * Smash DI (#155), as in Melee: during hitlag, each fresh flick of the stick from the centre to
 * past `SDI.threshold` moves the hit fighter `SDI.distance` that way. It is never pushed down
 * through a platform it stands on or is above, nor sideways into a solid one.
 */
import { SDI, STICK } from './config';
import type { Vec2 } from './math';
import type { PlayerInput, StageDef } from './types';

/** Whether this frame's stick is a fresh flick: centred last frame, past the threshold now. */
export const isSdiFlick = (input: PlayerInput, previous: PlayerInput): boolean =>
  Math.hypot(previous.x, previous.y) < STICK.deadzone &&
  Math.hypot(input.x, input.y) >= SDI.threshold;

/**
 * Where a fighter `halfWidth` wide at `position` ends up after an SDI flick of `input` on
 * `stage`.
 */
export const smashDi = (
  position: Vec2,
  input: PlayerInput,
  stage: StageDef,
  halfWidth: number,
): Vec2 => {
  const length = Math.hypot(input.x, input.y);
  let x = position.x + (input.x / length) * SDI.distance;
  let y = position.y + (input.y / length) * SDI.distance;
  for (const { bounds, passThrough } of stage.platforms) {
    // Not down through a platform it stands on or is above, also when flicked off its edge.
    const wasOver = position.x >= bounds.left && position.x <= bounds.right;
    const isOver = x >= bounds.left && x <= bounds.right;
    if ((wasOver || isOver) && position.y >= bounds.top && y < bounds.top) y = bounds.top;
    // Not sideways into a solid platform beside it.
    if (passThrough || y >= bounds.top || y <= bounds.bottom) continue;
    if (position.x - halfWidth >= bounds.right) x = Math.max(x, bounds.right + halfWidth);
    if (position.x + halfWidth <= bounds.left) x = Math.min(x, bounds.left - halfWidth);
  }
  return { x, y };
};
