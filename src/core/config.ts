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

/**
 * The capsule's stats (`CharacterStats`), the base every character starts from. The air physics
 * are Melee-near (#145): a full hop of about 40 frames, fast falls, and a fast fall that drops at
 * once at `fastFallSpeed`. `air-physics.test.ts` pins airtime, apex and fast fall per fighter.
 * On the ground it walks, dashes, dash dances and runs as in Melee (#146, `ground-movement.ts`).
 */
export const FIGHTER = {
  width: 0.8,
  height: 1.6,
  walkSpeed: 0.14,
  initialDashFrames: 11,
  dashSpeed: 0.19,
  runSpeed: 0.2,
  skidFrames: 14,
  groundAcceleration: 0.02,
  groundFriction: 0.015,
  airSpeed: 0.11,
  airAcceleration: 0.01,
  airFriction: 0.002,
  gravity: 0.0175,
  maxFallSpeed: 0.3,
  fastFallSpeed: 0.42,
  jumpSquatFrames: 3,
  jumpVelocity: 0.35,
  airJumpVelocity: 0.32,
  shortHopVelocity: 0.26,
  airJumps: 1,
  weight: 100,
  landingLagFrames: 4,
} as const satisfies CharacterStats;

/**
 * Rivet, fighter 1 (#39): the all-rounder, as heavy and as fast as the capsule, on a shorter and
 * broader body (`STOCKY` in `skeleton.ts`). He falls a little faster (#145): a shorter full hop
 * and a quicker drop, so his weight shows in the air too.
 */
export const RIVET_STATS = {
  ...FIGHTER,
  width: 0.85,
  height: 1.42,
  gravity: 0.019,
  maxFallSpeed: 0.32,
  fastFallSpeed: 0.45,
  jumpVelocity: 0.36,
  airJumpVelocity: 0.33,
  shortHopVelocity: 0.28,
} as const satisfies CharacterStats;

/**
 * Vela, fighter 2 (#53): the contrast to Rivet. Light, quick on the ground and in the air, and
 * floaty, with a second air jump: hard to pin down, but launched further by the same hit.
 */
export const VELA_STATS = {
  ...FIGHTER,
  width: 0.75,
  walkSpeed: 0.17,
  initialDashFrames: 10,
  dashSpeed: 0.23,
  runSpeed: 0.24,
  skidFrames: 12,
  groundAcceleration: 0.026,
  airSpeed: 0.13,
  airAcceleration: 0.012,
  gravity: 0.0145,
  maxFallSpeed: 0.25,
  fastFallSpeed: 0.36,
  jumpVelocity: 0.33,
  airJumpVelocity: 0.29,
  shortHopVelocity: 0.22,
  airJumps: 2,
  weight: 70,
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
  /**
   * Repeated dodges get weaker (#150), instead of a stamina bar (#10). A dodge of any kind that
   * starts less than `wearOffFrames` after the last one ended is one more in a row: each loses
   * `invulnerableLoss` invulnerable frames off the end and gains `extraFrames` of endlag, up to
   * `maxLevel` times (the floor), so a single dodge stays strong and nonstop rolling is punishable.
   */
  repeat: { wearOffFrames: 60, invulnerableLoss: 4, extraFrames: 6, maxLevel: 2 },
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

/**
 * L-cancel (#149), as in Melee: a dodge press during an aerial halves its landing lag if the
 * fighter lands within `windowFrames` of it (the press frame counts as the first), though never
 * below the normal landing lag. A new press only counts `lockoutFrames` after the last one that
 * did, so mashing the button misses.
 */
export const L_CANCEL = { windowFrames: 7, lockoutFrames: 20 } as const;

/**
 * Knockback (#153, ADR 0006), as in Melee. A hit's knockback, in Melee's units, is
 * `((p / 10 + p * d / 20) * 200 / (weight + 100) * 1.4 + 18) * growth / 100 + base`, with `p` the
 * target's percent after the hit and `d` the hit's damage. It launches at `speedPerUnit` stage
 * units per frame per unit, and that launch speed shrinks by `decayPerFrame` each frame along its
 * direction, while gravity pulls on the fighter's own speed. Hitstun is the knockback times
 * `hitstunPerUnit`, rounded down. From `tumbleFrom` on the fighter tumbles; below it, it flinches.
 *
 * The speeds are Melee's (0.03 per unit, decaying by 0.051) scaled by the capsule's gravity
 * against Mario's (0.0175 / 0.095), so launches and falls keep Melee's proportions.
 */
export const KNOCKBACK = {
  speedPerUnit: 0.0055,
  decayPerFrame: 0.0094,
  hitstunPerUnit: 0.4,
  tumbleFrom: 80,
} as const;

/**
 * Directional influence (#154), as in Melee: the stick held on the last frame of hitlag turns a
 * launch by up to `maxDegrees`, scaled by how far it points across the launch.
 */
export const DI = { maxDegrees: 18 } as const;

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
  /** Sideways deflection that keeps a dash running (#146); below it a run skids to a stop. */
  run: 0.6,
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
  /** One full walking stride, slower and shorter than the run's. */
  walkCycleFrames: 36,
} as const;

/** Training mode (#144): the dummy's percent range and how far one press in the panel moves it. */
export const TRAINING = {
  maxPercent: 999,
  percentStep: 10,
  /** A hit's frame advantage is dropped if either side is still busy after this many frames. */
  maxWatchFrames: 300,
} as const;
