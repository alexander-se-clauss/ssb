import type { MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * A quick straight punch. The fist is out from frame 2, hits on frames 3 to 5 of 18, and the arm
 * behind it is a weaker hit for targets right up close. Then the guard comes back up. Pressing
 * attack again from frame 6 on goes into jab 2.
 */
export const JAB: MoveDef = {
  kind: 'attack',
  id: 'jab',
  totalFrames: 14,
  hitboxes: [
    {
      anchor: { bone: 'lowerArmFront', at: 1 },
      radius: 0.3,
      from: 3,
      to: 6,
      priority: 1,
      // Light and nearly flat, so the target stays in reach for jab 2.
      damage: 4,
      angle: 20,
      baseKnockback: 0.05,
      knockbackGrowth: 0.002,
    },
    {
      anchor: { bone: 'upperArmFront', at: 1 },
      radius: 0.2,
      from: 3,
      to: 6,
      priority: 0,
      damage: 3,
      angle: 20,
      baseKnockback: 0.04,
      knockbackGrowth: 0.0015,
    },
  ],
  poses: [
    { frame: 2, pose: POSES.jab },
    { frame: 6, pose: POSES.jab },
    { frame: 11, pose: POSES.idle },
  ],
  cancels: [
    { on: 'jab', into: 'jab2', from: 6, to: 14 },
    // Out of the chain into a dodge, or the fighter's block or counter (#52).
    { on: 'dodge', from: 6, to: 14 },
    { on: 'downSpecial', from: 6, to: 14 },
  ],
};

/** The back fist follows: another light hit that keeps the target close for jab 3. */
export const JAB2: MoveDef = {
  kind: 'attack',
  id: 'jab2',
  totalFrames: 14,
  hitboxes: [
    {
      anchor: { bone: 'lowerArmBack', at: 1 },
      radius: 0.3,
      from: 3,
      to: 6,
      priority: 0,
      damage: 4,
      angle: 20,
      baseKnockback: 0.05,
      knockbackGrowth: 0.002,
    },
  ],
  poses: [
    { frame: 2, pose: POSES.jab2 },
    { frame: 6, pose: POSES.jab2 },
    { frame: 11, pose: POSES.idle },
  ],
  cancels: [
    { on: 'jab', into: 'jab3', from: 6, to: 14 },
    { on: 'dodge', from: 6, to: 14 },
    { on: 'downSpecial', from: 6, to: 14 },
  ],
};

/** The finisher: a front kick that launches. Slower to come out and to recover. */
export const JAB3: MoveDef = {
  kind: 'attack',
  id: 'jab3',
  totalFrames: 22,
  hitboxes: [
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.32,
      from: 5,
      to: 9,
      priority: 1,
      damage: 8,
      angle: 45,
      baseKnockback: 0.25,
      knockbackGrowth: 0.0035,
    },
    {
      anchor: { bone: 'lowerLegFront', at: 0 },
      radius: 0.22,
      from: 5,
      to: 9,
      priority: 0,
      damage: 6,
      angle: 45,
      baseKnockback: 0.2,
      knockbackGrowth: 0.003,
    },
  ],
  poses: [
    { frame: 4, pose: POSES.jab3 },
    { frame: 10, pose: POSES.jab3 },
    { frame: 18, pose: POSES.idle },
  ],
  // The finisher's long recovery can still be cut into a dodge, block or counter (#52).
  cancels: [
    { on: 'dodge', from: 12, to: 22 },
    { on: 'downSpecial', from: 12, to: 22 },
  ],
};
