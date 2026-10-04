/**
 * Dash and landing dust (#151): a little puff at the feet when a fighter dashes, turns in a dash
 * dance, skids, turns a run around, takes off or lands, read from the change between two states.
 * Purely visual: the game never sees it.
 */
import { characterOf, isLedgeClimb, type FighterState } from '../../core';
import type { Burst } from './hit-effects';

/** How far behind the feet a dash kicks its dust up, in stage units. */
const KICK_BACK = 0.35;

const puff = (x: number, y: number, count: number, power: number): Burst => ({
  effect: 'dust',
  x,
  y,
  count,
  power,
});

/**
 * The puff for what a fighter did between `before` and `after`: the last state the dust was
 * read from and the current one, so nothing is missed when a drawing spans several game frames.
 * At most one per fighter: a landing, a take-off, or a burst of speed along the ground. Across
 * such a gap the landing itself is never missed, but its size goes by the older fall speed.
 */
export const dustFor = (before: FighterState, after: FighterState): Burst | undefined => {
  // A respawn teleports; it is not a landing.
  if (after.action === 'eliminated' || after.falls !== before.falls) return undefined;
  const { x, y } = after.position;
  if (after.grounded && !before.grounded) {
    // Climbing up from a ledge is not a landing.
    if (isLedgeClimb(before.action) || before.action === 'ledge') return undefined;
    // Faster than a plain fall can go: a fast fall, or a fighter slammed down.
    const fast = before.velocity.y < -characterOf(after.characterId).stats.maxFallSpeed - 1e-6;
    return fast ? puff(x, y, 36, 1.5) : puff(x, y, 16, 0.9);
  }
  if (before.grounded && !after.grounded) {
    // A jump pushes off the ground, also when one drawing spans the whole jump squat; walking
    // off an edge does not, and a launch is no take-off.
    return after.velocity.y > 0 && after.action !== 'hitstun'
      ? puff(before.position.x, before.position.y, 12, 0.8)
      : undefined;
  }
  if (!after.grounded) return undefined;
  const started =
    after.action !== before.action ||
    after.facing !== before.facing ||
    after.actionFrame < before.actionFrame;
  if (!started) return undefined;
  switch (after.action) {
    case 'dash':
      return puff(x - after.facing * KICK_BACK, y, 14, 0.8);
    case 'skid':
    case 'runTurn':
      return puff(x + after.facing * KICK_BACK * 0.5, y, 14, 0.9);
    default:
      return undefined;
  }
};
