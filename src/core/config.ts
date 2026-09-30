/**
 * Tuning constants. Units: distance in stage units (~1 unit = 1 metre), time in simulation frames.
 * Velocities are units per frame, accelerations units per frame squared.
 */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

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
