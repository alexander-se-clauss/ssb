import type { MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * A quick straight punch. The fist is out from frame 2, hits on frames 3 to 5 of 18, and the arm
 * behind it is a weaker hit for targets right up close. Then the guard comes back up.
 */
export const JAB: MoveDef = {
  kind: 'attack',
  id: 'jab',
  totalFrames: 18,
  hitboxes: [
    {
      anchor: { bone: 'lowerArmFront', at: 1 },
      radius: 0.3,
      from: 3,
      to: 6,
      priority: 1,
      // The M0 jab's damage and knockback, now on the fist.
      damage: 6,
      angle: 40,
      baseKnockback: 0.12,
      knockbackGrowth: 0.0045,
    },
    {
      anchor: { bone: 'upperArmFront', at: 1 },
      radius: 0.2,
      from: 3,
      to: 6,
      priority: 0,
      damage: 4,
      angle: 40,
      baseKnockback: 0.1,
      knockbackGrowth: 0.004,
    },
  ],
  poses: [
    { frame: 2, pose: POSES.jab },
    { frame: 6, pose: POSES.jab },
    { frame: 14, pose: POSES.idle },
  ],
};
