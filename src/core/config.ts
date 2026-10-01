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
  gravity: 0.012,
  maxFallSpeed: 0.22,
  fastFallSpeed: 0.32,
  jumpVelocity: 0.3,
  doubleJumpVelocity: 0.27,
  /** Grounded jump plus air jumps. */
  totalJumps: 2,
  weight: 1,
  respawnInvulnerabilityFrames: 120,
} as const;

export interface AttackDef {
  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly totalFrames: number;
  /** Hitbox centre relative to the fighter's feet, x is mirrored by facing. */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly radius: number;
  readonly damage: number;
  readonly baseKnockback: number;
  readonly knockbackGrowth: number;
  /** Launch angle in degrees, 0 = straight forward, 90 = straight up. */
  readonly angle: number;
}

export const JAB: AttackDef = {
  startupFrames: 3,
  activeFrames: 3,
  totalFrames: 18,
  offsetX: 0.75,
  offsetY: 0.9,
  radius: 0.45,
  damage: 6,
  baseKnockback: 0.12,
  knockbackGrowth: 0.0045,
  angle: 40,
};

/** Hitstun frames per unit of launch speed. */
export const HITSTUN_PER_KNOCKBACK = 40;

/**
 * Analog stick tuning, shared by every device with a stick. Values are stick deflection, 0..1.
 * Input adapters apply these today; smash and tilt detection in core will read them too (#19).
 */
export const STICK = {
  /** Deflection below this counts as centred, so a worn stick does not drift. */
  deadzone: 0.2,
  /** Pushing up at least this far jumps (tap-jump), like "up" on the keyboard. */
  tapJump: 0.7,
} as const;
