/**
 * Rivet's specials (#39, #49). The neutral special is a slow, heavy punch with a lunge; the side
 * special a wrench that flies out and back; the up special is the recovery move: a rising
 * uppercut that hits several times and leaves Rivet helpless.
 */
import type { HitboxDef, MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * A haymaker: a long wind-up with the fist on fire, then a lunge into a punch on frame 18 that
 * hits harder than the forward smash. Usable in the air too, where it does not drift.
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
  // The fist catches fire as it winds up and burns through the punch (#47).
  effects: [{ effect: 'fire', anchor: { bone: 'lowerArmFront', at: 1 }, from: 6, to: 26 }],
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

/**
 * Iron Guard (#50), Rivet's down special: he braces behind his forearms. Up on frames 4 to 15,
 * and held up while special stays held; then a short recovery. It soaks hits from the front on
 * the ground; smash-strength hits break it.
 */
export const IRON_GUARD: MoveDef = {
  kind: 'attack',
  id: 'ironGuard',
  totalFrames: 24,
  hitboxes: [],
  poses: [
    { frame: 4, pose: POSES.guard },
    { frame: 16, pose: POSES.guard },
    { frame: 23, pose: POSES.idle },
  ],
  cancels: [],
  guard: {
    from: 4,
    to: 16,
    hold: 8,
    damageScale: 0.3,
    pushback: 1,
    breakDamage: 15,
    breakStun: 30,
  },
};

/**
 * Wrench Toss (#49), Rivet's side special: he flings a wrench on frame 10 that spins out about
 * four units, slowing to a stop, and comes back to his hand. It hits on the way out or back,
 * once, so even the all-rounder can reach a fighter keeping away. Usable in the air too.
 */
export const WRENCH_TOSS: MoveDef = {
  kind: 'attack',
  id: 'wrenchToss',
  totalFrames: 32,
  hitboxes: [],
  poses: [
    { frame: 6, pose: POSES.haymakerWindup },
    { frame: 10, pose: POSES.haymaker },
    { frame: 14, pose: POSES.haymaker },
    { frame: 30, pose: POSES.idle },
  ],
  cancels: [],
  spawns: [
    {
      frame: 10,
      offset: { x: 0.7, y: 1 },
      velocity: { x: 0.32, y: 0 },
      lifetime: 90,
      radius: 0.28,
      hit: { damage: 7, angle: 40, baseKnockback: 0.18, knockbackGrowth: 0.004 },
      behavior: { kind: 'return', turnFrames: 22 },
    },
  ],
};
