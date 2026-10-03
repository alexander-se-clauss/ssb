import type { MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * The attack from the ledge (#41), played once the fighter has climbed onto the stage: a low
 * sweeping kick from a crouch that clears someone waiting at the ledge. Weak, so it is a way back
 * on, not a kill move.
 */
export const LEDGE_ATTACK: MoveDef = {
  kind: 'attack',
  id: 'ledgeAttack',
  totalFrames: 24,
  hitboxes: [
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.35,
      from: 4,
      to: 9,
      priority: 1,
      damage: 8,
      angle: 30,
      baseKnockback: 0.2,
      knockbackGrowth: 0.003,
    },
    {
      anchor: { bone: 'lowerLegFront', at: 0.3 },
      radius: 0.25,
      from: 4,
      to: 9,
      priority: 0,
      damage: 6,
      angle: 30,
      baseKnockback: 0.18,
      knockbackGrowth: 0.0025,
    },
  ],
  poses: [
    { frame: 0, pose: POSES.crouch },
    { frame: 4, pose: POSES.forwardTilt },
    { frame: 9, pose: POSES.forwardTilt },
    { frame: 20, pose: POSES.idle },
  ],
  cancels: [],
};
