import type { MoveDef } from '../moves';

/** The M0 jab, unchanged: one hit in front of the chest on frames 3 to 5 of 18. */
export const JAB: MoveDef = {
  kind: 'attack',
  id: 'jab',
  totalFrames: 18,
  hitboxes: [
    {
      anchor: { feet: { x: 0.75, y: 0.9 } },
      radius: 0.45,
      from: 3,
      to: 6,
      priority: 0,
      damage: 6,
      angle: 40,
      baseKnockback: 0.12,
      knockbackGrowth: 0.0045,
    },
  ],
};
