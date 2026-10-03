/**
 * Ledges (#40): where a fighter hangs from one, and which ledge a falling fighter catches.
 * Holding on and letting go are part of the fighter's update (`fighter.ts`).
 */
import { LEDGE } from './config';
import type { Vec2 } from './math';
import { POSES } from './pose-data';
import { plantedBoneSegments } from './skeleton';
import type { CharacterDef, LedgeDef, StageDef } from './types';

/**
 * Where a character hangs from a ledge: below and beside it, with the front hand of its hanging
 * pose on the ledge's corner. Measured on the character's own skeleton, so a taller body hangs
 * lower.
 */
export const hangPosition = (ledge: LedgeDef, character: CharacterDef): Vec2 => {
  const hand = plantedBoneSegments(character.skeleton, POSES.ledge, { x: 0, y: 0 }, ledge.facing)
    .lowerArmFront.end;
  return { x: ledge.position.x - hand.x, y: ledge.position.y - hand.y };
};

/**
 * The index of the closest free ledge whose hanging spot lies within `LEDGE.snap` of `position`,
 * or `null` if there is none. `taken` lists the ledges other fighters hold.
 */
export const ledgeInReach = (
  stage: StageDef,
  character: CharacterDef,
  position: Vec2,
  taken: readonly number[],
): number | null => {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const [index, ledge] of stage.ledges.entries()) {
    if (taken.includes(index)) continue;
    const hang = hangPosition(ledge, character);
    const dx = position.x - hang.x;
    const dy = position.y - hang.y;
    if (Math.abs(dx) > LEDGE.snap.x || dy > LEDGE.snap.above || dy < -LEDGE.snap.below) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
};
