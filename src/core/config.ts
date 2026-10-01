import type { MatchRules } from './types';

/**
 * Tuning constants. Units: distance in stage units (~1 unit = 1 metre), time in simulation frames.
 * Velocities are units per frame, accelerations units per frame squared.
 */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export const DEFAULT_RULES: MatchRules = { mode: 'stock', stocks: 3, timeLimitSeconds: 120 };

/** What the rules overlay on character select lets players pick. */
export const RULE_LIMITS = {
  minStocks: 1,
  maxStocks: 99,
  minTimeLimitSeconds: 60,
  maxTimeLimitSeconds: 3600,
  timeLimitStepSeconds: 60,
} as const;

export const FIGHTER = {
  width: 0.8,
  height: 1.6,
  walkSpeed: 0.14,
  groundAcceleration: 0.02,
  groundFriction: 0.015,
  airSpeed: 0.1,
  airAcceleration: 0.008,
  airFriction: 0.002,
  /**
   * How fast horizontal speed above `airSpeed` bleeds off in the air, whatever caused it: a
   * launch, or running off a ledge. Drift input only takes over once it is down to `airSpeed`.
   */
  launchDecay: 0.015,
  gravity: 0.012,
  maxFallSpeed: 0.22,
  fastFallSpeed: 0.32,
  /**
   * Frames crouched on the ground before a jump leaves it; a ground attack can start instead.
   * Keep it below `STICK.smashWindowFrames`, so a stick flicked up (which tap-jumps) and attack
   * pressed on the last squat frame is still an up smash.
   */
  jumpSquatFrames: 3,
  jumpVelocity: 0.3,
  doubleJumpVelocity: 0.27,
  /** Grounded jump plus air jumps. */
  totalJumps: 2,
  weight: 1,
  respawnInvulnerabilityFrames: 120,
} as const;

/** Hitstun frames per unit of launch speed. */
export const HITSTUN_PER_KNOCKBACK = 40;

/** How long a press waits in the input buffer for the fighter to be able to act on it. */
export const INPUT = { bufferFrames: 6 } as const;

/**
 * Hitlag (ADR 0006): on a hit, attacker and target both freeze for
 * `floor((baseFrames + damage / damagePerFrame) * hitlagScale)` frames, as in Melee.
 */
export const HITLAG = { baseFrames: 3, damagePerFrame: 3 } as const;

/**
 * Analog stick tuning, shared by every device with a stick. Values are stick deflection, 0..1.
 * Input adapters apply the deadzone and tap-jump; `attack-input.ts` tells tilts from smashes.
 */
export const STICK = {
  /** Deflection below this counts as centred, so a worn stick does not drift. */
  deadzone: 0.2,
  /** Pushing up at least this far jumps (tap-jump), like "up" on the keyboard. */
  tapJump: 0.7,
  /** Deflection that counts as the rim, for smash detection. */
  smash: 0.8,
  /** A flick reaches the rim within this many frames of leaving the deadzone. */
  flickFrames: 3,
  /** Frames after a flick in which attack still makes a smash, the flick frame included. */
  smashWindowFrames: 4,
} as const;

/** Body poses: how fast they blend and how the idle and run motions cycle. */
export const POSE = {
  /** Share of the remaining difference a pose closes each frame, so switches never pop. */
  blend: 0.4,
  /** One breath of the idle sway, in frames. */
  idleCycleFrames: 90,
  /** One full stride (both legs), in frames. */
  runCycleFrames: 24,
  /** Launch speed from which a hit fighter tumbles instead of flinching. */
  tumbleSpeed: 0.4,
} as const;
