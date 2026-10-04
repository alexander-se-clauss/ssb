/**
 * Moves as plain data (ADR 0006): a move is a `MoveDef`, and one move runner plays any of them.
 * Fighters store only the move's id and frame, never the definition, so state stays small and
 * serializable.
 */
import type { Vec2 } from './math';
import type { PressSlot } from './move-slots';
import { HUMANOID, type BoneId, type Pose } from './skeleton';

export type MoveId = string;

/**
 * Where a hitbox sits: on a bone of the planted body, from 0 (its start joint) to 1 (its end
 * joint), or relative to the feet with x mirrored by facing.
 */
export type HitboxAnchor = { readonly bone: BoneId; readonly at: number } | { readonly feet: Vec2 };

/** What a hit does to its target: damage and launch. Hitboxes and spawned objects share it. */
export interface HitDef {
  readonly damage: number;
  /** Launch angle in degrees, 0 = straight forward, 90 = straight up. */
  readonly angle: number;
  readonly baseKnockback: number;
  /** Extra knockback per percent of the target's damage. */
  readonly knockbackGrowth: number;
  /** Multiplies this hit's hitlag (`HITLAG` in config); default 1. */
  readonly hitlagScale?: number;
}

export interface HitboxDef extends HitDef {
  readonly anchor: HitboxAnchor;
  readonly radius: number;
  /** First active frame of the move. */
  readonly from: number;
  /** First frame after the active ones. */
  readonly to: number;
  /** A target is hit once per group; a multi-hit move gives each hit its own. Default 0. */
  readonly group?: number;
  /** When several hitboxes touch a target on one frame, the highest wins, then list order. */
  readonly priority: number;
}

/**
 * How a spawned object moves (#46), chosen by data:
 * - `straight`: on at its speed.
 * - `arc`: pulled down by its own `gravity` each frame; gone once it lands on a platform.
 * - `trap`: stays where it was set (its spawn has no speed); hits only from `armFrames` on.
 * - `return`: slows evenly to a stop at `turnFrames`, then flies back to its owner at its start
 *   speed, following the owner, and is gone when it reaches them or they are out of the match.
 */
export type ObjectBehavior =
  | { readonly kind: 'straight' }
  | { readonly kind: 'arc'; readonly gravity: number }
  | { readonly kind: 'trap'; readonly armFrames: number }
  | { readonly kind: 'return'; readonly turnFrames: number };

/**
 * An object the move spawns on its `frame` (#45), such as a fireball: it starts at `offset` from
 * the feet and flies at `velocity` (both with x the way the fighter faces), hits the first other
 * fighter its circle touches, and is gone after `lifetime` frames.
 */
export interface SpawnDef {
  readonly frame: number;
  readonly offset: Vec2;
  readonly velocity: Vec2;
  readonly lifetime: number;
  readonly radius: number;
  readonly hit: HitDef;
  /** How it moves; `straight` if left out. */
  readonly behavior?: ObjectBehavior;
  /** A cosmetic effect its object trails while it flies (#47), such as `fire`. */
  readonly effect?: EffectId;
}

/**
 * What a press asks for, kept in the input buffer: a move slot, a dodge or a jump. Block and
 * counter are moves in the `downSpecial` slot (#50, #51).
 */
export type BufferedAction = PressSlot | DodgeKind | 'jump';

/**
 * The ground dodges (#35): a sidestep into the background or out towards the camera, or a roll
 * the way the stick points; and the air dodge (#36). A buffered roll's `face` is the way it
 * travels.
 */
export type DodgeKind = 'sidestepIn' | 'sidestepOut' | 'roll' | 'airDodge';

export const isDodge = (action: BufferedAction): action is DodgeKind =>
  action === 'sidestepIn' || action === 'sidestepOut' || action === 'roll' || action === 'airDodge';

/**
 * A window in which the move gives way to a buffered action: on frames `[from, to)`, a buffered
 * `on` starts `into` (the next combo step), or the character's move for that slot. `dodge` (#52)
 * takes any dodge that can start; `downSpecial` is the character's block or counter, if any.
 */
export interface CancelDef {
  readonly on: BufferedAction | 'dodge';
  readonly into?: MoveId;
  readonly from: number;
  readonly to: number;
}

/** Names a cosmetic effect (#47), such as `fire`; how it looks is up to the view. */
export type EffectId = string;

/**
 * A cosmetic effect the move shows on frames `[from, to)`, at an anchor on the body like a
 * hitbox's. Views draw it; it never changes the game.
 */
export interface EffectKey {
  readonly effect: EffectId;
  readonly anchor: HitboxAnchor;
  readonly from: number;
  readonly to: number;
}

/**
 * A block (#50): on frames `[from, to)` the move guards the fighter's front, on the ground only.
 * A hit from the front deals `damageScale` of its damage and no launch; it pushes the blocker
 * back instead, at `pushback` times the launch it would give a fighter at no damage. A hit of `breakDamage` or
 * more breaks the guard: it lands in full, with `breakStun` more frames of hitstun.
 */
export interface GuardDef {
  readonly from: number;
  readonly to: number;
  /** While the special button stays held, the move waits on this frame, guard up. */
  readonly hold?: number;
  readonly damageScale: number;
  readonly pushback: number;
  readonly breakDamage: number;
  readonly breakStun: number;
}

/**
 * A counter (#51): a hit that connects on frames `[from, to)` deals no damage and no launch;
 * the fighter turns to where it came from and starts `into`, its counterattack, unhittable until
 * that attack's hitboxes are done. It works on the ground and in the air.
 */
export interface CounterDef {
  readonly from: number;
  readonly to: number;
  readonly into: MoveId;
}

export interface PoseKey {
  readonly frame: number;
  readonly pose: Pose;
}

/**
 * On `frame` of its move, the fighter's speed is set (#39): `x` the way it faces, `y` upward. A
 * part left out keeps its speed. An upward speed takes a grounded fighter off the ground.
 */
export interface MotionKey {
  readonly frame: number;
  readonly x?: number;
  readonly y?: number;
}

export interface AttackMoveDef {
  readonly kind: 'attack';
  readonly id: MoveId;
  /** The move runs from frame 0 to `totalFrames - 1`, then the fighter is free again. */
  readonly totalFrames: number;
  readonly hitboxes: readonly HitboxDef[];
  /**
   * The body's keyframes. Before the first, the body eases towards it; from the first on, it
   * follows them exactly, so a bone hitbox reaches the same spot every time.
   */
  readonly poses: readonly PoseKey[];
  readonly cancels: readonly CancelDef[];
  /**
   * Makes the move an aerial: landing while it runs ends it, and the fighter is stuck for this
   * many frames. Ground moves leave it out.
   */
  readonly landingLag?: number;
  /**
   * A recovery move (#44): if it ends with the fighter in the air, the fighter is helpless until
   * it lands or grabs a ledge, able only to drift. Such a move has no cancels.
   */
  readonly helpless?: true;
  /** Speeds the move sets on its frames, such as a lunge or the rise of a recovery move. */
  readonly motion?: readonly MotionKey[];
  /** Objects the move spawns, such as projectiles (#45). */
  readonly spawns?: readonly SpawnDef[];
  /**
   * At most this many of the move's objects per fighter at once (#49), such as one mine: a new
   * one removes that fighter's oldest. No limit if left out.
   */
  readonly spawnLimit?: number;
  /** Cosmetic effects on the body while the move plays (#47), such as fire on a fist. */
  readonly effects?: readonly EffectKey[];
  /** Makes the move a block (#50); it starts only on the ground. */
  readonly guard?: GuardDef;
  /** Makes the move a counter (#51). */
  readonly counter?: CounterDef;
}

/** Every move is an attack move; a block is one with a `guard` (#50). */
export type MoveDef = AttackMoveDef;

export interface MoveTiming {
  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly totalFrames: number;
}

/** Startup, active and recovery are not stored; they follow from the hitbox windows. */
export const moveTiming = (move: MoveDef): MoveTiming => {
  const starts = move.hitboxes.map((hitbox) => hitbox.from);
  const ends = move.hitboxes.map((hitbox) => hitbox.to);
  const startupFrames = starts.length > 0 ? Math.min(...starts) : move.totalFrames;
  const activeFrames = ends.length > 0 ? Math.max(...ends) - startupFrames : 0;
  return { startupFrames, activeFrames, totalFrames: move.totalFrames };
};

/** Throws on a definition the runner cannot play, naming the move. */
export const validateMove = (move: MoveDef): void => {
  const fail = (problem: string): never => {
    throw new Error(`Move "${move.id}": ${problem}`);
  };
  if (!Number.isInteger(move.totalFrames) || move.totalFrames < 1) {
    fail(`totalFrames must be a positive whole number, got ${move.totalFrames}`);
  }
  const checkAnchor = (anchor: HitboxAnchor, what: string): void => {
    if ('bone' in anchor) {
      if (!HUMANOID.bones.some((bone) => bone.id === anchor.bone)) {
        fail(`${what} is on an unknown bone "${anchor.bone}"`);
      }
      if (!(anchor.at >= 0 && anchor.at <= 1)) fail(`${what} is off its bone (${anchor.at})`);
    } else if (!(Number.isFinite(anchor.feet.x) && Number.isFinite(anchor.feet.y))) {
      fail(`${what} has a bad position`);
    }
  };
  move.hitboxes.forEach((hitbox, index) => {
    const { from, to } = hitbox;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) {
      fail(`hitbox ${index} has an empty or broken window [${from}, ${to})`);
    }
    if (to > move.totalFrames) fail(`hitbox ${index} ends after the move (${to})`);
    if (!(hitbox.radius > 0)) fail(`hitbox ${index} needs a positive radius`);
    const scale = hitbox.hitlagScale ?? 1;
    if (!(Number.isFinite(scale) && scale >= 0)) fail(`hitbox ${index} has a bad hitlagScale`);
    const group = hitbox.group ?? 0;
    if (!Number.isInteger(group) || group < 0) fail(`hitbox ${index} has a bad group ${group}`);
    checkAnchor(hitbox.anchor, `hitbox ${index}`);
  });
  // A cancel would hand the fighter a move that ends with full control, escaping helpless (#44).
  if (move.helpless && move.cancels.length > 0) fail('a helpless move cannot have cancels');
  const first = move.poses[0];
  if (!first) fail('needs at least one pose keyframe');
  move.poses.forEach((key, index) => {
    const before = move.poses[index - 1];
    if (!Number.isInteger(key.frame) || key.frame < 0 || key.frame >= move.totalFrames) {
      fail(`keyframe ${index} is outside the move (${key.frame})`);
    }
    if (before && key.frame <= before.frame) fail(`keyframe ${index} is out of order`);
  });
  move.cancels.forEach(({ from, to }, index) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) {
      fail(`cancel ${index} has an empty or broken window [${from}, ${to})`);
    }
    if (to > move.totalFrames) fail(`cancel ${index} ends after the move (${to})`);
    const { on, into } = move.cancels[index] ?? { on: 'dodge' };
    if (on === 'dodge' && into !== undefined)
      fail(`cancel ${index} into a dodge cannot name a move`);
    // Such a window could never fire: a dodge cancel is `dodge`, and a jump cancels nothing.
    if (on === 'jump' || (on !== 'dodge' && isDodge(on))) {
      fail(`cancel ${index} on "${on}" never fires; use "dodge" for dodges`);
    }
  });
  // The frame a move starts on is its frame 0; the runner plays it from frame 1 on.
  (move.motion ?? []).forEach(({ frame, x, y }, index, keys) => {
    if (!Number.isInteger(frame) || frame < 1 || frame >= move.totalFrames) {
      fail(`motion ${index} is outside the move (${frame})`);
    }
    const before = keys[index - 1];
    if (before && frame <= before.frame) fail(`motion ${index} is out of order`);
    if ([x, y].some((speed) => speed !== undefined && !Number.isFinite(speed))) {
      fail(`motion ${index} has a bad speed`);
    }
  });
  if (move.spawnLimit !== undefined) {
    if (!Number.isInteger(move.spawnLimit) || move.spawnLimit < 1) {
      fail(`spawnLimit must be a whole number of at least 1 (${move.spawnLimit})`);
    }
    if (!move.spawns?.length) fail('spawnLimit without spawns');
  }
  (move.spawns ?? []).forEach((spawn, index) => {
    const { frame, offset, velocity, lifetime, radius, hit } = spawn;
    // Like motion, a spawn on the start frame would never come out: the runner plays from 1 on.
    if (!Number.isInteger(frame) || frame < 1 || frame >= move.totalFrames) {
      fail(`spawn ${index} is outside the move (${frame})`);
    }
    if (!Number.isInteger(lifetime) || lifetime < 1) {
      fail(`spawn ${index} needs a lifetime of at least one whole frame`);
    }
    if (!(radius > 0)) fail(`spawn ${index} needs a positive radius`);
    const { damage, angle, baseKnockback, knockbackGrowth } = hit;
    const numbers = [offset.x, offset.y, velocity.x, velocity.y];
    if (!numbers.every(Number.isFinite)) fail(`spawn ${index} has a bad position or speed`);
    if (![damage, angle, baseKnockback, knockbackGrowth].every(Number.isFinite)) {
      fail(`spawn ${index} has a bad hit number`);
    }
    const scale = hit.hitlagScale ?? 1;
    if (!(Number.isFinite(scale) && scale >= 0)) fail(`spawn ${index} has a bad hitlagScale`);
    if (spawn.effect === '') fail(`spawn ${index} names no effect`);
    const whole = (frames: number): boolean => Number.isInteger(frames) && frames < lifetime;
    const behavior = spawn.behavior ?? { kind: 'straight' };
    if (behavior.kind === 'arc' && !(Number.isFinite(behavior.gravity) && behavior.gravity > 0)) {
      fail(`spawn ${index} needs a positive gravity to arc`);
    }
    if (behavior.kind === 'trap' && !(whole(behavior.armFrames) && behavior.armFrames >= 0)) {
      fail(`spawn ${index} must arm on a whole frame within its lifetime`);
    }
    if (behavior.kind === 'trap' && (velocity.x !== 0 || velocity.y !== 0)) {
      fail(`spawn ${index} is a trap and cannot move`);
    }
    if (behavior.kind === 'return' && !(whole(behavior.turnFrames) && behavior.turnFrames >= 1)) {
      fail(`spawn ${index} must turn on a whole frame within its lifetime`);
    }
  });
  (move.effects ?? []).forEach((key, index) => {
    if (key.effect === '') fail(`effect ${index} has no name`);
    const { from, to } = key;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) {
      fail(`effect ${index} has an empty or broken window [${from}, ${to})`);
    }
    if (to > move.totalFrames) fail(`effect ${index} ends after the move (${to})`);
    checkAnchor(key.anchor, `effect ${index}`);
  });
  const { guard } = move;
  if (guard) {
    const { from, to, hold } = guard;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) {
      fail(`guard has an empty or broken window [${from}, ${to})`);
    }
    if (to > move.totalFrames) fail(`guard ends after the move (${to})`);
    if (hold !== undefined && !(Number.isInteger(hold) && hold >= from && hold < to)) {
      fail(`guard must hold on a whole frame within its window (${hold})`);
    }
    if (!(guard.damageScale >= 0 && guard.damageScale <= 1)) {
      fail(`guard must take 0 to 1 of the damage (${guard.damageScale})`);
    }
    if (!(Number.isFinite(guard.pushback) && guard.pushback >= 0)) {
      fail(`guard needs a pushback of 0 or more (${guard.pushback})`);
    }
    if (!(Number.isFinite(guard.breakDamage) && guard.breakDamage > 0)) {
      fail(`guard needs a positive breakDamage (${guard.breakDamage})`);
    }
    if (!(Number.isInteger(guard.breakStun) && guard.breakStun >= 0)) {
      fail(`guard needs a whole breakStun of 0 or more (${guard.breakStun})`);
    }
  }
  if (move.counter) {
    const { from, to } = move.counter;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) {
      fail(`counter has an empty or broken window [${from}, ${to})`);
    }
    if (to > move.totalFrames) fail(`counter ends after the move (${to})`);
    if (guard) fail('a move cannot both guard and counter');
  }
  if (
    move.landingLag !== undefined &&
    !(Number.isInteger(move.landingLag) && move.landingLag >= 1)
  ) {
    fail(`landingLag must be at least one whole frame, got ${move.landingLag}`);
  }
  // From the first keyframe on the pose is exact, so a bone hitbox reaches the same spot.
  if (first && first.frame > moveTiming(move).startupFrames) {
    fail(`the first keyframe (${first.frame}) comes after the first hitbox`);
  }
};
