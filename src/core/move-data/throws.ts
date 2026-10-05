import type { MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * The four throws (#160), each with its role. The forward throw sends low along the stage
 * towards the ledge in front.
 */
export const FORWARD_THROW: MoveDef = {
  kind: 'attack',
  id: 'forwardThrow',
  totalFrames: 30,
  hitboxes: [],
  throw: {
    frame: 12,
    direction: 1,
    hit: { damage: 7, angle: 35, baseKnockback: 45, knockbackGrowth: 70 },
  },
  poses: [
    { frame: 0, pose: POSES.grab },
    { frame: 8, pose: POSES.forwardSmashWindup },
    { frame: 12, pose: POSES.jab },
    { frame: 26, pose: POSES.idle },
  ],
  cancels: [],
};

/** The back throw swings the held fighter round behind: the KO throw at high percent. */
export const BACK_THROW: MoveDef = {
  kind: 'attack',
  id: 'backThrow',
  totalFrames: 36,
  hitboxes: [],
  throw: {
    frame: 16,
    direction: -1,
    hit: { damage: 10, angle: 40, baseKnockback: 40, knockbackGrowth: 110 },
  },
  poses: [
    { frame: 0, pose: POSES.grab },
    { frame: 10, pose: POSES.backAirWindup },
    { frame: 16, pose: POSES.backAir },
    { frame: 32, pose: POSES.idle },
  ],
  cancels: [],
};

/**
 * The up throw tosses the held fighter straight up without a tumble at low percent: the combo
 * throw, leaving the thrower free while it is still in hitstun above.
 */
export const UP_THROW: MoveDef = {
  kind: 'attack',
  id: 'upThrow',
  totalFrames: 28,
  hitboxes: [],
  throw: {
    frame: 12,
    direction: 1,
    hit: { damage: 4, angle: 88, baseKnockback: 50, knockbackGrowth: 100 },
  },
  poses: [
    { frame: 0, pose: POSES.grab },
    { frame: 8, pose: POSES.upSmashWindup },
    { frame: 12, pose: POSES.upSmash },
    { frame: 24, pose: POSES.idle },
  ],
  cancels: [],
};

/**
 * The down throw slams the held fighter into the ground in front: the tech chase throw. It lands
 * in a tumble at once, so it techs or is knocked down right there, with the thrower free to cover
 * the tech, roll or getup.
 */
export const DOWN_THROW: MoveDef = {
  kind: 'attack',
  id: 'downThrow',
  totalFrames: 26,
  hitboxes: [],
  throw: {
    frame: 14,
    direction: 1,
    hit: { damage: 5, angle: -70, baseKnockback: 80, knockbackGrowth: 30 },
  },
  poses: [
    { frame: 0, pose: POSES.grab },
    { frame: 10, pose: POSES.downSmashWindup },
    { frame: 14, pose: POSES.downSmash },
    { frame: 24, pose: POSES.idle },
  ],
  cancels: [],
};
