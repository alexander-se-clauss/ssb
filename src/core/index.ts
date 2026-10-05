/** Public API of the core. Other layers import from here, never from core internals. */
export * from './types';
export * from './math';
export * from './config';
export * from './input';
export * from './attack-input';
export * from './skeleton';
export { POSES, blendPose, movePose, poseName, targetPose, type PoseName } from './poses';
export * from './stages';
export * from './registry';
export { characterOf, validateCharacter } from './character';
export { climbFrames, isLedgeClimb, type LedgeClimb } from './ledge';
export { dodgeFrames, type DodgeFrames } from './dodge-frames';
export { createMatch, step } from './simulation';
export { leader, playedFrames, score, timeLeftFrames } from './rules';
export {
  activeCounter,
  activeEffects,
  activeGuard,
  activeHitboxes,
  hurtboxes,
  knockback,
  launchSpeed,
  hitstunOf,
  type ActiveEffect,
  type Hitbox,
  type Hurtbox,
} from './combat';
export * from './moves';
export * from './move-slots';
export { MOVES, findMove } from './move-data';
export { activeGrabBox, isHolding, type GrabBox } from './grab';
export { isArmed } from './objects';
export { damageScale } from './stale';
export { FixedStepClock } from './time';
export { configureTraining, resetTraining } from './training';
