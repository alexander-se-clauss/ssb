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
export { createMatch, step } from './simulation';
export { leader, playedFrames, score, timeLeftFrames } from './rules';
export { activeHitboxes, hurtboxes, knockback, type Hitbox, type Hurtbox } from './combat';
export * from './moves';
export * from './move-slots';
export { MOVES, findMove } from './move-data';
export { FixedStepClock } from './time';
