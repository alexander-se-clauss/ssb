/** Public API of the core. Other layers import from here, never from core internals. */
export * from './types';
export * from './math';
export * from './config';
export * from './input';
export * from './attack-input';
export * from './skeleton';
export { POSES, blendPose, poseName, targetPose, type PoseName } from './poses';
export * from './stages';
export * from './registry';
export { createMatch, step } from './simulation';
export { leader, score, timeLeftFrames } from './rules';
export { activeHitbox, hurtbox, knockback } from './combat';
export { FixedStepClock } from './time';
