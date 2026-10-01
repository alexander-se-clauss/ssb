/**
 * Standard smash attacks: slow to start, strong enough to KO. Not charged for now (#33); holding
 * attack to charge is parked.
 */
import type { MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * A lunging straight punch: the fist is cocked back for a long wind-up, then the whole body drives
 * it forward on frame 13. The fist hits hardest; the forearm and elbow are weaker.
 */
export const FORWARD_SMASH: MoveDef = {
  kind: 'attack',
  id: 'forwardSmash',
  totalFrames: 42,
  hitboxes: [
    {
      anchor: { bone: 'lowerArmFront', at: 1 },
      radius: 0.35,
      from: 13,
      to: 17,
      priority: 2,
      damage: 16,
      angle: 38,
      baseKnockback: 0.2,
      knockbackGrowth: 0.006,
    },
    {
      anchor: { bone: 'lowerArmFront', at: 0.3 },
      radius: 0.28,
      from: 13,
      to: 17,
      priority: 1,
      damage: 14,
      angle: 38,
      baseKnockback: 0.2,
      knockbackGrowth: 0.0055,
    },
    {
      anchor: { bone: 'upperArmFront', at: 1 },
      radius: 0.22,
      from: 13,
      to: 17,
      priority: 0,
      damage: 12,
      angle: 38,
      baseKnockback: 0.18,
      knockbackGrowth: 0.005,
    },
  ],
  poses: [
    { frame: 6, pose: POSES.forwardSmashWindup },
    { frame: 10, pose: POSES.forwardSmashWindup },
    { frame: 13, pose: POSES.forwardSmash },
    { frame: 17, pose: POSES.forwardSmash },
    { frame: 34, pose: POSES.idle },
  ],
  cancels: [],
};

/**
 * A flip kick: from a crouch, the front leg swings up in front and over the head. Clean on frames
 * 9 to 11 it launches straight up; the late part of the swing is weaker.
 */
export const UP_SMASH: MoveDef = {
  kind: 'attack',
  id: 'upSmash',
  totalFrames: 40,
  hitboxes: [
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.35,
      from: 9,
      to: 12,
      priority: 2,
      damage: 15,
      angle: 86,
      baseKnockback: 0.15,
      knockbackGrowth: 0.0034,
    },
    {
      anchor: { bone: 'lowerLegFront', at: 0 },
      radius: 0.25,
      from: 9,
      to: 12,
      priority: 1,
      damage: 12,
      angle: 84,
      baseKnockback: 0.12,
      knockbackGrowth: 0.003,
    },
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.3,
      from: 12,
      to: 16,
      priority: 0,
      damage: 10,
      angle: 80,
      baseKnockback: 0.1,
      knockbackGrowth: 0.0025,
    },
  ],
  poses: [
    { frame: 4, pose: POSES.upSmashWindup },
    { frame: 8, pose: POSES.upSmashWindup },
    { frame: 11, pose: POSES.upSmash },
    { frame: 15, pose: POSES.upSmashEnd },
    { frame: 30, pose: POSES.idle },
  ],
  cancels: [],
};

/**
 * A split kick that covers both sides at once: each foot sends its target away from the
 * fighter, low and far. The back foot's angle points behind (180 - 25 degrees).
 */
export const DOWN_SMASH: MoveDef = {
  kind: 'attack',
  id: 'downSmash',
  totalFrames: 36,
  hitboxes: [
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.32,
      from: 6,
      to: 10,
      priority: 1,
      damage: 14,
      angle: 25,
      baseKnockback: 0.2,
      knockbackGrowth: 0.0045,
    },
    {
      anchor: { bone: 'lowerLegBack', at: 1 },
      radius: 0.32,
      from: 6,
      to: 10,
      priority: 1,
      damage: 14,
      angle: 155,
      baseKnockback: 0.2,
      knockbackGrowth: 0.0045,
    },
  ],
  poses: [
    { frame: 3, pose: POSES.downSmashWindup },
    { frame: 6, pose: POSES.downSmash },
    { frame: 10, pose: POSES.downSmash },
    { frame: 28, pose: POSES.idle },
  ],
  cancels: [],
};
