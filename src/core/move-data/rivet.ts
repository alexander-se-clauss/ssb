/**
 * Rivet's specials (#39). The neutral special is a slow, heavy punch with a lunge; the up special
 * is the recovery move: a rising uppercut that hits several times and leaves Rivet helpless.
 */
import type { HitboxDef, MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * A haymaker: a long wind-up, then a lunge into a punch on frame 18 that hits harder than the
 * forward smash. Usable in the air too, where it does not drift.
 */
export const HAYMAKER: MoveDef = {
  kind: 'attack',
  id: 'haymaker',
  totalFrames: 50,
  hitboxes: [
    {
      anchor: { bone: 'lowerArmFront', at: 1 },
      radius: 0.38,
      from: 18,
      to: 22,
      priority: 1,
      damage: 18,
      angle: 40,
      baseKnockback: 0.22,
      knockbackGrowth: 0.0068,
    },
    {
      anchor: { bone: 'upperArmFront', at: 1 },
      radius: 0.26,
      from: 18,
      to: 22,
      priority: 0,
      damage: 14,
      angle: 40,
      baseKnockback: 0.2,
      knockbackGrowth: 0.0058,
    },
  ],
  poses: [
    { frame: 8, pose: POSES.haymakerWindup },
    { frame: 14, pose: POSES.haymakerWindup },
    { frame: 18, pose: POSES.haymaker },
    { frame: 22, pose: POSES.haymaker },
    { frame: 42, pose: POSES.idle },
  ],
  cancels: [],
  motion: [{ frame: 16, x: 0.16 }],
};

/**
 * One of the weak rising hits, which carry the target up with Rivet: on the fist overhead, and on
 * the body for a target beside it rather than above.
 */
const CARRY_SPOTS: readonly Pick<HitboxDef, 'anchor' | 'radius'>[] = [
  { anchor: { bone: 'lowerArmFront', at: 1 }, radius: 0.42 },
  { anchor: { bone: 'torso', at: 0.6 }, radius: 0.45 },
];

const carry = (group: number, from: number): HitboxDef[] =>
  CARRY_SPOTS.map(({ anchor, radius }) => ({
    anchor,
    radius,
    from,
    to: from + 3,
    group,
    priority: 0,
    damage: 2,
    angle: 88,
    baseKnockback: 0.34,
    knockbackGrowth: 0,
    hitlagScale: 0.5,
  }));

/**
 * Spring jack: from a crouch, Rivet springs up on frame 4 with the fist overhead. Four weak hits
 * carry a target up, the fifth launches it. Helpless after, with its own landing lag if it touches
 * down early.
 */
export const SPRING_JACK: MoveDef = {
  kind: 'attack',
  id: 'springJack',
  totalFrames: 34,
  hitboxes: [
    ...carry(0, 4),
    ...carry(1, 7),
    ...carry(2, 10),
    ...carry(3, 13),
    {
      anchor: { bone: 'lowerArmFront', at: 1 },
      radius: 0.45,
      from: 16,
      to: 20,
      group: 4,
      priority: 1,
      damage: 5,
      angle: 80,
      baseKnockback: 0.4,
      knockbackGrowth: 0.005,
    },
  ],
  poses: [
    { frame: 0, pose: POSES.springJackStart },
    { frame: 4, pose: POSES.springJack },
    { frame: 22, pose: POSES.springJack },
    { frame: 33, pose: POSES.fall },
  ],
  cancels: [],
  landingLag: 14,
  helpless: true,
  motion: [{ frame: 4, x: 0.04, y: 0.34 }],
};
