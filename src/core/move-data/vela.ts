/**
 * Vela's specials (#51, #53): she keeps opponents out with shots from her arm cannon, recovers
 * with a long thruster boost, and her down special is a counter that answers a hit with a
 * point-blank blast.
 */
import type { MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * Riposte Blast: the counterattack. A quick blast from the cannon that launches hard, so a
 * read counter pays off; Riposte starts it as soon as a hit lands in its window.
 */
export const RIPOSTE_BLAST: MoveDef = {
  kind: 'attack',
  id: 'riposteBlast',
  totalFrames: 30,
  hitboxes: [
    {
      anchor: { bone: 'lowerArmFront', at: 1 },
      radius: 0.5,
      from: 4,
      to: 8,
      priority: 1,
      damage: 12,
      angle: 35,
      baseKnockback: 0.24,
      knockbackGrowth: 0.0055,
    },
    {
      anchor: { bone: 'upperArmFront', at: 1 },
      radius: 0.35,
      from: 4,
      to: 8,
      priority: 0,
      damage: 10,
      angle: 35,
      baseKnockback: 0.22,
      knockbackGrowth: 0.005,
    },
  ],
  poses: [
    { frame: 2, pose: POSES.counterStance },
    { frame: 4, pose: POSES.counterStrike },
    { frame: 10, pose: POSES.counterStrike },
    { frame: 26, pose: POSES.idle },
  ],
  cancels: [],
};

/**
 * Riposte (#51), Vela's down special: she waits in a low stance. A hit that connects on frames 5
 * to 24 deals her nothing and sets off Riposte Blast, turned to where the hit came from; a whiff
 * leaves her 20 frames to be punished. Works in the air too, and landing does not end it, nor
 * the blast (neither is an aerial with landing lag).
 */
export const RIPOSTE: MoveDef = {
  kind: 'attack',
  id: 'riposte',
  totalFrames: 45,
  hitboxes: [],
  poses: [
    { frame: 4, pose: POSES.counterStance },
    { frame: 25, pose: POSES.counterStance },
    { frame: 42, pose: POSES.idle },
  ],
  cancels: [],
  counter: { from: 5, to: 25, into: 'riposteBlast' },
};

/**
 * Pulse Shot (#53), Vela's neutral special: a plasma bolt from the cannon on frame 12 that flies
 * straight across the stage. Weak, to poke and keep opponents out rather than to kill. Usable in
 * the air too.
 */
export const PULSE_SHOT: MoveDef = {
  kind: 'attack',
  id: 'pulseShot',
  totalFrames: 34,
  hitboxes: [],
  poses: [
    { frame: 6, pose: POSES.counterStance },
    { frame: 12, pose: POSES.counterStrike },
    { frame: 20, pose: POSES.counterStrike },
    { frame: 32, pose: POSES.idle },
  ],
  cancels: [],
  spawns: [
    {
      frame: 12,
      offset: { x: 0.75, y: 1.05 },
      velocity: { x: 0.36, y: 0 },
      lifetime: 40,
      radius: 0.24,
      hit: { damage: 6, angle: 35, baseKnockback: 0.16, knockbackGrowth: 0.0025 },
      effect: 'plasma',
    },
  ],
};

/**
 * Thruster (#53), Vela's up special and recovery: after a short ignition she boosts up and
 * forward on her boot jets, much further sideways than Rivet's Spring Jack climbs, hitting anyone
 * she rams on the way, hardest at the start. Helpless after, with its own landing lag if she touches down early.
 */
export const THRUSTER: MoveDef = {
  kind: 'attack',
  id: 'thruster',
  totalFrames: 36,
  hitboxes: [
    {
      anchor: { bone: 'torso', at: 0.5 },
      radius: 0.5,
      from: 6,
      to: 12,
      priority: 0,
      damage: 7,
      angle: 60,
      baseKnockback: 0.2,
      knockbackGrowth: 0.004,
    },
    // The rest of the boost still rams, weaker; one group, so a target is hit only once.
    {
      anchor: { bone: 'torso', at: 0.5 },
      radius: 0.45,
      from: 12,
      to: 28,
      priority: 0,
      damage: 4,
      angle: 55,
      baseKnockback: 0.16,
      knockbackGrowth: 0.003,
    },
  ],
  poses: [
    { frame: 0, pose: POSES.springJackStart },
    { frame: 6, pose: POSES.thruster },
    { frame: 30, pose: POSES.thruster },
    { frame: 35, pose: POSES.fall },
  ],
  cancels: [],
  landingLag: 16,
  helpless: true,
  motion: [
    { frame: 6, x: 0.16, y: 0.24 },
    { frame: 14, x: 0.16, y: 0.2 },
    { frame: 22, x: 0.14, y: 0.14 },
  ],
  // The boot jets burn while she boosts (#47).
  effects: [
    { effect: 'fire', anchor: { bone: 'lowerLegFront', at: 1 }, from: 4, to: 28 },
    { effect: 'fire', anchor: { bone: 'lowerLegBack', at: 1 }, from: 4, to: 28 },
  ],
};

/**
 * Stasis Mine (#49), Vela's side special: she crouches and sets a mine in front of her feet, on
 * the ground or hanging in the air where she is, to guard a ledge. It arms after half a second and pops the first opponent who steps on it straight up, into
 * a juggle; unused, it fades after ten seconds. One at a time: a new mine replaces the old.
 */
export const STASIS_MINE: MoveDef = {
  kind: 'attack',
  id: 'stasisMine',
  totalFrames: 36,
  hitboxes: [],
  poses: [
    { frame: 8, pose: POSES.crouch },
    { frame: 18, pose: POSES.crouch },
    { frame: 34, pose: POSES.idle },
  ],
  cancels: [],
  spawns: [
    {
      frame: 12,
      offset: { x: 1, y: 0.15 },
      velocity: { x: 0, y: 0 },
      lifetime: 600,
      radius: 0.3,
      hit: { damage: 9, angle: 88, baseKnockback: 0.3, knockbackGrowth: 0.004 },
      behavior: { kind: 'trap', armFrames: 30 },
    },
  ],
  spawnLimit: 1,
};
