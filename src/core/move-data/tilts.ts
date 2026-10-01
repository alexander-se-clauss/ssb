import type { HitboxDef, MoveDef } from '../moves';
import { POSES } from '../pose-data';

/** The strong hit at the foot and a weaker one at the shin, for one kick. */
const kick = (
  foot: Omit<HitboxDef, 'anchor' | 'priority'>,
  shin: Omit<HitboxDef, 'anchor' | 'priority' | 'from' | 'to'> & { readonly at: number },
): HitboxDef[] => [
  { ...foot, anchor: { bone: 'lowerLegFront', at: 1 }, priority: 1 },
  {
    ...shin,
    anchor: { bone: 'lowerLegFront', at: shin.at },
    priority: 0,
    from: foot.from,
    to: foot.to,
  },
];

/**
 * A side kick at chest height: the knee comes up, the leg snaps straight on frame 5 and stays out
 * to frame 8. Safe at range, with enough knockback to push a target away.
 */
export const FORWARD_TILT: MoveDef = {
  kind: 'attack',
  id: 'forwardTilt',
  totalFrames: 26,
  hitboxes: kick(
    {
      radius: 0.3,
      from: 5,
      to: 9,
      damage: 9,
      angle: 35,
      baseKnockback: 0.15,
      knockbackGrowth: 0.004,
    },
    { at: 0.3, radius: 0.22, damage: 7, angle: 35, baseKnockback: 0.12, knockbackGrowth: 0.0035 },
  ),
  poses: [
    { frame: 2, pose: POSES.kickChamber },
    { frame: 5, pose: POSES.forwardTilt },
    { frame: 9, pose: POSES.forwardTilt },
    { frame: 20, pose: POSES.idle },
  ],
  cancels: [],
};

/**
 * An overhead scissor kick: the leg swings from in front, over the head and behind it. It pops
 * the target almost straight up with little knockback, so it can follow itself at low damage.
 */
export const UP_TILT: MoveDef = {
  kind: 'attack',
  id: 'upTilt',
  totalFrames: 24,
  hitboxes: kick(
    {
      radius: 0.3,
      from: 4,
      to: 10,
      damage: 8,
      angle: 82,
      baseKnockback: 0.12,
      knockbackGrowth: 0.0025,
    },
    { at: 0, radius: 0.22, damage: 6, angle: 82, baseKnockback: 0.1, knockbackGrowth: 0.002 },
  ),
  poses: [
    { frame: 3, pose: POSES.upTiltStart },
    { frame: 6, pose: POSES.upTilt },
    { frame: 10, pose: POSES.upTiltEnd },
    { frame: 18, pose: POSES.idle },
  ],
  cancels: [],
};

/**
 * A low sweep from a crouch: hits the legs and lifts the target gently, a combo starter. The
 * crouch also lowers the body under high attacks.
 */
export const DOWN_TILT: MoveDef = {
  kind: 'attack',
  id: 'downTilt',
  totalFrames: 24,
  hitboxes: kick(
    {
      radius: 0.3,
      from: 7,
      to: 10,
      damage: 8,
      angle: 80,
      baseKnockback: 0.1,
      knockbackGrowth: 0.002,
    },
    { at: 0.4, radius: 0.22, damage: 6, angle: 80, baseKnockback: 0.08, knockbackGrowth: 0.0018 },
  ),
  poses: [
    { frame: 3, pose: POSES.crouch },
    { frame: 7, pose: POSES.downTilt },
    { frame: 10, pose: POSES.downTilt },
    { frame: 20, pose: POSES.idle },
  ],
  cancels: [],
};
