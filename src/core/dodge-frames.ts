/** Dodge frame data (#35, #36), and how repeated dodges get weaker (#150). */
import { DODGE } from './config';
import type { FighterAction } from './types';

/** The base frame data of a dodge action, or undefined for any other action. */
export const baseDodge = (action: FighterAction) =>
  action === 'sidestepIn' || action === 'sidestepOut'
    ? DODGE.sidestep
    : action === 'forwardRoll' || action === 'backRoll'
      ? DODGE.roll
      : action === 'airDodge'
        ? DODGE.air
        : undefined;

export interface DodgeFrames {
  readonly totalFrames: number;
  /** It cannot be hit on frames `[invulnerableFrom, invulnerableTo)`. */
  readonly invulnerableFrom: number;
  readonly invulnerableTo: number;
}

/**
 * The frame data of a dodge action as the `streak`-th dodge in a row (#150): from the second on,
 * fewer invulnerable frames and more endlag, down to `DODGE.repeat.maxLevel`.
 */
export const dodgeFrames = (action: FighterAction, streak: number): DodgeFrames | undefined => {
  const base = baseDodge(action);
  if (!base) return undefined;
  const { invulnerableLoss, extraFrames, maxLevel } = DODGE.repeat;
  const level = Math.min(Math.max(streak - 1, 0), maxLevel);
  return {
    totalFrames: base.totalFrames + level * extraFrames,
    invulnerableFrom: base.invulnerableFrom,
    invulnerableTo: base.invulnerableTo - level * invulnerableLoss,
  };
};
