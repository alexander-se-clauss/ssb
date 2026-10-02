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
 * plane and back, as in Melee, instead of bending the body. It is back on the plane on the last
 * invulnerable frame, so a fighter that can be hit looks it. Only the view moves; the game
 * stays on its 2D plane.
 */
export const dodgeDepth = (fighter: Pick<FighterState, 'action' | 'actionFrame'>): number => {
  const dodge = dodgeData(fighter.action);
  // Back by the last invulnerable frame, so the view, which interpolates from that frame to the
  // next, never draws a fighter that can be hit away from the plane.
  const back = dodge === undefined ? 0 : dodge.invulnerableTo - 1;
  if (dodge === undefined || fighter.actionFrame >= back) return 0;
  const progress = Math.max(0, fighter.actionFrame / back);
  return -DODGE_DEPTH * Math.sin(Math.PI * progress);
};
