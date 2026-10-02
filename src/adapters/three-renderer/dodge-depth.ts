import { DODGE, type FighterState } from '../../core';

/** How far a dodging fighter steps back into the screen, in stage units. */
export const DODGE_DEPTH = 0.9;

const dodgeData = (action: FighterState['action']) => {
  switch (action) {
    case 'spotDodge':
      return DODGE.spot;
    case 'forwardRoll':
    case 'backRoll':
      return DODGE.roll;
    case 'airDodge':
      return DODGE.air;
    default:
      return undefined;
  }
};

/**
 * The fighter's depth offset (towards the back is negative): a dodge steps out of the stage
 * plane and back, as in Melee, instead of bending the body. It is back on the plane when the
 * invulnerability ends, so a fighter that can be hit looks it. Only the view moves; the game
 * stays on its 2D plane.
 */
export const dodgeDepth = (fighter: Pick<FighterState, 'action' | 'actionFrame'>): number => {
  const dodge = dodgeData(fighter.action);
  if (dodge === undefined || fighter.actionFrame >= dodge.invulnerableTo) return 0;
  const progress = Math.max(0, fighter.actionFrame / dodge.invulnerableTo);
  return -DODGE_DEPTH * Math.sin(Math.PI * progress);
};
