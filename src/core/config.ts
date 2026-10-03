import type { CharacterStats, MatchRules } from './types';

/**
 * Tuning constants. Units: distance in stage units (~1 unit = 1 metre), time in simulation frames.
 * Velocities are units per frame, accelerations units per frame squared.
 */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export const DEFAULT_RULES: MatchRules = { mode: 'stock', stocks: 3, timeLimitSeconds: 120 };

/**
 * The READY countdown at the start of a match, as in Melee: fighters stand still and ignore
 * input until GO, and the match clock starts at GO.
 */
export const COUNTDOWN = {
  frames: 90,
  /** How long the GO! banner stays up after the countdown. */
  goBannerFrames: 50,
} as const;

/** What the rules overlay on character select lets players pick. */
export const RULE_LIMITS = {
  minStocks: 1,
  maxStocks: 99,
  minTimeLimitSeconds: 60,
  maxTimeLimitSeconds: 3600,
  timeLimitStepSeconds: 60,
} as const;

/** The capsule's stats (`CharacterStats`); other characters start from them. */
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
  jumpSquatFrames: 3,
  jumpVelocity: 0.3,
  airJumpVelocity: 0.27,
  airJumps: 1,
  weight: 1,
  landingLagFrames: 4,
} as const satisfies CharacterStats;

/**
 * Rivet, fighter 1 (#39): the all-rounder, as heavy and as fast as the capsule, on a shorter and
 * broader body (`STOCKY` in `skeleton.ts`).
 */
export const RIVET_STATS = {
  ...FIGHTER,
  width: 0.85,
  height: 1.42,
} as const satisfies CharacterStats;

/** Rules every fighter shares, whatever its character. */
export const FIGHTER_RULES = {
  /**
   * How fast horizontal speed above `airSpeed` bleeds off in the air, whatever caused it: a
   * launch, or running off a ledge. Drift input only takes over once it is down to `airSpeed`.
   */
  launchDecay: 0.015,
  respawnInvulnerabilityFrames: 120,
} as const;

/**
 * Dodges, pressed with the dodge button. On the ground (#35) a sidestep out of the stage plane
 * (into the background with the stick up or centred, towards the camera with it down), or a roll
 * along it the way the stick points sideways; in the air (#36) an Ultimate-style air dodge, once
 * per airtime. There is
 * no shield, so dodging is everyone's defence. Invulnerable on frames
 * `[invulnerableFrom, invulnerableTo)` of the dodge, open to a punish after that.
 */
export const DODGE = {
  /**
   * Sideways stick deflection (and more than up or down) that makes a ground dodge a roll.
   * Otherwise it sidesteps: towards the camera with the stick down past the deadzone, else into
   * the background.
   */
  rollStick: 0.5,
  /**
   * A roll counts from the facing before a turn the stick made at most this many frames ago: a
   * direction key pressed a moment before the dodge key still gives a back roll.
   */
  turnGraceFrames: 4,
  sidestep: { totalFrames: 22, invulnerableFrom: 2, invulnerableTo: 17 },
  roll: {
    totalFrames: 30,
    invulnerableFrom: 4,
    invulnerableTo: 19,
    /**
     * The roll travels `distance` evenly over frames `[moveFrom, moveTo)`. A back roll keeps the
     * facing; a forward roll turns around at the end, as in Melee.
     */
    moveFrom: 2,
    moveTo: 22,
    distance: 2.2,
  },
  air: {
    totalFrames: 40,
    invulnerableFrom: 3,
    invulnerableTo: 20,
    /** Stick deflection from which the air dodge goes that way; below it, it holds in place. */
    directionStick: 0.3,
    /**
     * Speed at the start, in the stick's direction (0 in place). It shrinks by `drag` each
     * frame, with gravity paused, until frame `moveTo`; then the fighter falls again.
     */
    speed: 0.3,
    drag: 0.85,
    moveTo: 16,
    /** Landing during the air dodge ends it with this landing lag. */
    landingLag: 10,
  },
} as const;

/**
 * Ledges (#40). A fighter falling near a ledge snaps to it: within `snap` of where it would hang
 * (`ledge.ts`), sideways, above and below. Holding on gives brief invulnerability, the air jumps
 * and the air dodge back; after `hangFrames` the fighter lets go, and can grab a ledge again
 * `regrabFrames` later. Only a fighter falling under control (`airborne`) grabs: an aerial or an
 * air dodge sails past, as in Melee.
 *
 * From `waitFrames` after the grab the fighter picks an option (#41) with a fresh input, a press
 * or the stick pushed past `stick` (held input does not count): jump jumps up past the ledge,
 * dodge rolls onto the stage, attack or special climbs up and attacks (the character's
 * `ledgeAttack`), the stick towards the stage or up stands up, and the stick down or away lets
 * go. Climbing takes `climbFrames`: up beside the ledge first, then in onto the stage, ending
 * `distance` from its corner. Each option is invulnerable for its first `invulnerableFrames`, or
 * for what is left of the grab's if that is longer, as in Melee, and done after `totalFrames`
 * (the attack: after its move).
 */
export const LEDGE = {
  snap: { x: 1, above: 0.6, below: 1.2 },
  invulnerableFrames: 30,
  hangFrames: 300,
  regrabFrames: 30,
  waitFrames: 8,
  stick: 0.5,
  getup: {
    stand: { climbFrames: 20, totalFrames: 30, invulnerableFrames: 24, distance: 0.7 },
    /** Climbs `climbDistance` onto the stage, then rolls on to `distance` until frame `rollTo`. */
    roll: {
      climbFrames: 14,
      climbDistance: 0.4,
      rollTo: 36,
      totalFrames: 46,
      invulnerableFrames: 34,
      distance: 2.6,
    },
    attack: { climbFrames: 18, invulnerableFrames: 24, distance: 0.7 },
    jump: { invulnerableFrames: 10 },
  },
} as const;

/**
 * The helpless state after a recovery move (#44), as Melee's special fall: the fighter drifts at
 * `drift` of its air speed, cannot fast-fall, jump, attack or dodge, and lands with
 * `landingLagFrames` of lag. A ledge grab or a hit ends it.
 */
export const HELPLESS = { drift: 0.7, landingLagFrames: 10 } as const;

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
  /** Pushing up at least this far jumps (tap-jump). Keyboard up only aims; it has a jump key. */
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
