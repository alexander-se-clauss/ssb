import type { MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * The attack out of a knockdown (#158): up from the ground with a kick to the front, then one to
 * the back, so it clears someone waiting on either side. Weak, and invulnerable only at first, so
 * a tech chaser who sees it coming can punish its end.
 */
export const GETUP_ATTACK: MoveDef = {
  kind: 'attack',
  id: 'getupAttack',
  totalFrames: 44,
  hitboxes: [
    {
      anchor: { bone: 'lowerLegFront', at: 1 },
      radius: 0.4,
      from: 10,
      to: 14,
      priority: 1,
      damage: 6,
      angle: 30,
      baseKnockback: 30,
      knockbackGrowth: 50,
    },
    {
      anchor: { bone: 'lowerLegBack', at: 1 },
      radius: 0.4,
      from: 18,
      to: 22,
      priority: 1,
      damage: 6,
      angle: 150,
      baseKnockback: 30,
      knockbackGrowth: 50,
    },
  ],
  poses: [
    { frame: 0, pose: POSES.downed },
    { frame: 6, pose: POSES.crouch },
    { frame: 10, pose: POSES.downSmash },
    { frame: 14, pose: POSES.downSmashWindup },
    { frame: 18, pose: POSES.downSmash },
    { frame: 22, pose: POSES.downSmash },
    { frame: 36, pose: POSES.idle },
  ],
  cancels: [],
};
