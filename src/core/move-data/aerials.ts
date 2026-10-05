/**
 * Aerials (#34): attacks in the air. Each has a landing lag; landing while one runs ends it and,
 * outside its `autoCancel` windows (#148), the fighter is stuck for that many frames, so a late
 * aerial is punishable. Tuned with the blast
 * zones (#42): from a short hop over Battlefield's centre the back and up aerials KO at about 125%,
 * the forward aerial at 130%, the weak neutral aerial at 155%.
 */
import type { MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * A sex kick: out on frame 4, strongest while fresh, then the leg stays out as a weaker hit to
 * the end of frame 23. Fast and safe, the get-off-me move.
 */
export const NEUTRAL_AIR: MoveDef = {
  kind: 'attack',
  id: 'neutralAir',
  totalFrames: 36,
  landingLag: 6,
  autoCancel: { before: 4, after: 30 },
  hitboxes: [
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.32,
      from: 4,
      to: 8,
      priority: 1,
      damage: 11,
      angle: 40,
      baseKnockback: 9,
      knockbackGrowth: 73,
    },
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.28,
      from: 8,
      to: 24,
      priority: 0,
      damage: 6,
      angle: 40,
      baseKnockback: 0,
      knockbackGrowth: 73,
    },
  ],
  poses: [
    { frame: 3, pose: POSES.neutralAir },
    { frame: 24, pose: POSES.neutralAir },
    { frame: 32, pose: POSES.fall },
  ],
  cancels: [],
};

/** A double-fist hammer swung down in front: a slow wind-up, then a strong hit forward. */
export const FORWARD_AIR: MoveDef = {
  kind: 'attack',
  id: 'forwardAir',
  totalFrames: 36,
  landingLag: 12,
  autoCancel: { before: 6, after: 28 },
  hitboxes: [
    {
      anchor: { bone: 'lowerArmFront', at: 1 },
      radius: 0.38,
      from: 7,
      to: 11,
      priority: 1,
      damage: 13,
      angle: 45,
      baseKnockback: 11,
      knockbackGrowth: 75,
    },
    {
      anchor: { bone: 'upperArmFront', at: 1 },
      radius: 0.25,
      from: 7,
      to: 11,
      priority: 0,
      damage: 10,
      angle: 45,
      baseKnockback: 6,
      knockbackGrowth: 73,
    },
  ],
  poses: [
    { frame: 4, pose: POSES.forwardAirWindup },
    { frame: 7, pose: POSES.forwardAir },
    { frame: 12, pose: POSES.forwardAir },
    { frame: 30, pose: POSES.fall },
  ],
  cancels: [],
};

/**
 * A mule kick straight behind: the strongest aerial, sending the target away behind the
 * fighter (the angle points backwards, 180 - 35 degrees).
 */
export const BACK_AIR: MoveDef = {
  kind: 'attack',
  id: 'backAir',
  totalFrames: 30,
  landingLag: 9,
  autoCancel: { before: 5, after: 22 },
  hitboxes: [
    {
      anchor: { bone: 'lowerLegBack', at: 1 },
      radius: 0.32,
      from: 6,
      to: 10,
      priority: 1,
      damage: 13,
      angle: 145,
      baseKnockback: 13,
      knockbackGrowth: 72,
    },
    {
      anchor: { bone: 'lowerLegBack', at: 0.3 },
      radius: 0.24,
      from: 6,
      to: 10,
      priority: 0,
      damage: 9,
      angle: 145,
      baseKnockback: 5,
      knockbackGrowth: 79,
    },
  ],
  poses: [
    { frame: 3, pose: POSES.backAirWindup },
    { frame: 6, pose: POSES.backAir },
    { frame: 10, pose: POSES.backAir },
    { frame: 24, pose: POSES.fall },
  ],
  cancels: [],
};

/** A flip kick over the head: juggles a target above almost straight up. */
export const UP_AIR: MoveDef = {
  kind: 'attack',
  id: 'upAir',
  totalFrames: 32,
  landingLag: 9,
  autoCancel: { before: 4, after: 24 },
  hitboxes: [
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.32,
      from: 5,
      to: 10,
      priority: 1,
      damage: 11,
      angle: 85,
      baseKnockback: 14,
      knockbackGrowth: 100,
    },
    {
      anchor: { bone: 'lowerLegFront', at: 0 },
      radius: 0.24,
      from: 5,
      to: 10,
      priority: 0,
      damage: 8,
      angle: 85,
      baseKnockback: 5,
      knockbackGrowth: 113,
    },
  ],
  poses: [
    { frame: 3, pose: POSES.upAirStart },
    { frame: 6, pose: POSES.upAir },
    { frame: 10, pose: POSES.upAirEnd },
    { frame: 26, pose: POSES.fall },
  ],
  cancels: [],
};

/**
 * A stomp: both feet driven down on frames 8 to 12. It spikes a target below straight down
 * (270 degrees), and lands with the longest lag.
 */
export const DOWN_AIR: MoveDef = {
  kind: 'attack',
  id: 'downAir',
  totalFrames: 40,
  landingLag: 15,
  autoCancel: { before: 6, after: 36 },
  hitboxes: [
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.32,
      from: 8,
      to: 13,
      priority: 1,
      damage: 14,
      angle: 270,
      baseKnockback: 16,
      knockbackGrowth: 65,
    },
    {
      anchor: { bone: 'lowerLegBack', at: 1 },
      radius: 0.32,
      from: 8,
      to: 13,
      priority: 1,
      damage: 14,
      angle: 270,
      baseKnockback: 16,
      knockbackGrowth: 65,
    },
  ],
  poses: [
    { frame: 4, pose: POSES.downAirWindup },
    { frame: 8, pose: POSES.downAir },
    { frame: 13, pose: POSES.downAir },
    { frame: 32, pose: POSES.fall },
  ],
  cancels: [],
};
