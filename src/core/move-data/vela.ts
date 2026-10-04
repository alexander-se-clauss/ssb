/**
 * Vela's specials (#51 on): she is the counter fighter, so her down special waits for a hit and
 * answers it with a point-blank blast from her arm cannon.
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
