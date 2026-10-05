/**
 * Serializable game data. Everything in here must be plain data (no classes, no functions)
 * so it can be cloned, hashed, stored as a replay and sent over the network unchanged.
 */
import type { Rect, Vec2 } from './math';
import type { StickTracker } from './attack-input';
import type { MoveSlot } from './move-slots';
import type { BufferedAction, EffectId, HitDef, MoveId, ObjectBehavior } from './moves';
import type { Pose, SkeletonDef } from './skeleton';

/** Index of a player in the match, 0-based. */
export type PlayerSlot = number;

/** One frame of input for one player, already mapped from a device (keyboard, gamepad, network). */
export interface PlayerInput {
  /** Horizontal stick, -1 (left) .. 1 (right). */
  readonly x: number;
  /** Vertical stick, -1 (down) .. 1 (up). */
  readonly y: number;
  readonly jump: boolean;
  readonly attack: boolean;
  readonly special: boolean;
  /** The dodge button (#35). Named after Melee's shield button; this game has no shield. */
  readonly shield: boolean;
  /**
   * The short hop button (#147): jumps like `jump`, but a ground jump leaves at the fighter's
   * `shortHopVelocity`, low enough for a quick aerial. In the air it is the air jump.
   */
  readonly shortHop: boolean;
  /** The Start button. Menus use it; the simulation ignores it. */
  readonly start: boolean;
}

export type FighterAction =
  | 'idle'
  /** Ground movement (#146): a slowly pushed stick walks, a flick dashes, holding on runs. */
  | 'walk'
  | 'dash'
  | 'run'
  /** Braking to a halt after the stick let go of a run. */
  | 'skid'
  /** Braking out of a run the stick pushed back against, then turning round. */
  | 'runTurn'
  | 'jumpsquat'
  | 'airborne'
  | 'landing'
  | 'attack'
  | 'sidestepIn'
  | 'sidestepOut'
  | 'forwardRoll'
  | 'backRoll'
  | 'airDodge'
  /** After a recovery move (#44): only drifting until landing or a ledge grab. */
  | 'helpless'
  /** Hanging on a ledge (#40). */
  | 'ledge'
  /** Climbing from a ledge onto the stage (#41): to stand, to roll on, or to attack. */
  | 'ledgeStand'
  | 'ledgeRoll'
  | 'ledgeAttack'
  | 'hitstun'
  | 'eliminated';

/** A press waiting until the fighter can act on it (ADR 0006). */
export interface BufferedInput {
  readonly action: BufferedAction;
  /**
   * The way the move faces when it starts, fixed at the press: a ground attack aimed behind turns
   * around (#28), even if the fighter turned in between.
   */
  readonly face: 1 | -1;
  /** Frames since the press, not counting hitlag; dropped after `INPUT.bufferFrames`. */
  readonly age: number;
  /** A jump pressed with the short hop button (#147); a ground jump from it is a short hop. */
  readonly shortHop?: boolean;
}

/** One target hit by one hitbox group of the current move (ADR 0006). */
export interface HitRecord {
  readonly slot: PlayerSlot;
  readonly group: number;
}

export interface FighterState {
  readonly slot: PlayerSlot;
  /** Registry id of the character this fighter plays. */
  readonly characterId: string;
  readonly position: Vec2;
  /**
   * Total speed this frame: its own movement plus what is left of a launch (`knockback`).
   */
  readonly velocity: Vec2;
  /**
   * What is left of the last launch (#153), part of `velocity`: it decays along its direction
   * each frame while the fighter's own speed falls with gravity, as in Melee.
   */
  readonly knockback: Vec2;
  /**
   * Launched hard enough to tumble (#153): from the hit until the fighter acts or lands. A
   * weaker hit only flinches.
   */
  readonly tumbling: boolean;
  readonly facing: 1 | -1;
  readonly grounded: boolean;
  readonly jumpsRemaining: number;
  /** The jump squat under way ends in a short hop (#147), not a full jump. */
  readonly shortHop: boolean;
  /** The facing before the stick last turned the fighter, and frames since (`DODGE.turnGraceFrames`). */
  readonly turnedFrom: { readonly facing: 1 | -1; readonly age: number } | null;
  /** The air dodge is used up until the fighter lands or is hit (#36). */
  readonly airDodgeUsed: boolean;
  /**
   * Dodges in the current or last streak, the current one included (#150), counted up to
   * `DODGE.repeat.maxLevel + 1`: later ones in a row are weaker.
   */
  readonly dodgeStreak: number;
  /** Frames since the last dodge ended; from `DODGE.repeat.wearOffFrames` on, the streak is over. */
  readonly dodgeRestFrames: number;
  readonly action: FighterAction;
  /** Frames spent in the current action; during an attack, the frame of the move. */
  readonly actionFrame: number;
  /** The move being played while `action` is `'attack'` (ADR 0006), otherwise `null`. */
  readonly moveId: string | null;
  /** Damage percent. Higher damage means stronger knockback. */
  readonly damage: number;
  /** Lives left in a stock match. Unused (0) in a time match. */
  readonly stocks: number;
  /** Opponents this fighter knocked out. */
  readonly kos: number;
  /** Times this fighter was knocked out or self-destructed. */
  readonly falls: number;
  /** Total damage percent this fighter's attacks caused this match. */
  readonly damageDealt: number;
  /**
   * The moves of this fighter's last hits, newest first (#157): each use of a move counts once,
   * on its first hit. Emptied when it loses a stock.
   */
  readonly staleMoves: readonly MoveId[];
  /** Who hit this fighter last since it respawned; gets the KO credit. */
  readonly lastHitBy: PlayerSlot | null;
  readonly hitstunFrames: number;
  /** Frames left in the `landing` action: an aerial's landing lag, or the normal one. */
  readonly landingLagFrames: number;
  /**
   * Frames since the dodge press during an aerial that counts for an L-cancel (#149), or `null`
   * when there is none: none yet, landed, or the lockout is over.
   */
  readonly lCancelPress: number | null;
  /** How the last landing out of an aerial went (#149), for the training readout. */
  readonly lastLanding: AerialLanding | null;
  /** Frames left frozen by a hit (ADR 0006): nothing moves, the move and pose stand still. */
  readonly hitlagFrames: number;
  readonly invulnerableFrames: number;
  /**
   * Index into the stage's `ledges` of the ledge the fighter hangs from (`'ledge'`) or climbs
   * from (`'ledgeStand'`, `'ledgeRoll'`, `'ledgeAttack'`), else `null`.
   */
  readonly ledge: number | null;
  /** Frames left before the fighter can grab a ledge again after letting go of one. */
  readonly ledgeRegrabFrames: number;
  /** Who the current move already hit, per hitbox group, so one swing hits each target once. */
  readonly hitTargets: readonly HitRecord[];
  /** The latest press the fighter has not acted on yet, if any. */
  readonly buffer: BufferedInput | null;
  /** The stick's recent history, to tell a tilt from a smash when a button is pressed. */
  readonly stick: StickTracker;
  /** Input of the previous frame, used for press (edge) detection inside the simulation. */
  readonly previousInput: PlayerInput;
  /** Joint angles the body shows this frame, eased towards the state's pose (`poses.ts`). */
  readonly pose: Pose;
}

/**
 * Something a move spawned that lives on its own (#45), such as a projectile. Plain data: it
 * carries its own hit, so it stays valid when its owner's move ends, or its owner is KO-ed.
 */
export interface SpawnedObject {
  /** Unique within the match, in spawn order, so views can follow an object frame to frame. */
  readonly id: number;
  /** Who spawned it: it never hits them, and they get the credit for its hits. */
  readonly owner: PlayerSlot;
  /** The move that spawned it, for that move's `spawnLimit` (#49). */
  readonly moveId: MoveId;
  /** The centre of its circle. */
  readonly position: Vec2;
  readonly velocity: Vec2;
  /** Its speed when it spawned; a returning object slows down from it and flies back at it. */
  readonly launchVelocity: Vec2;
  /** The way its owner faced when it spawned; it launches that way when not flying sideways. */
  readonly facing: 1 | -1;
  /** Frames since it spawned; it is gone once `age` reaches `lifetime`. */
  readonly age: number;
  readonly lifetime: number;
  readonly radius: number;
  readonly hit: HitDef;
  /** How it moves (#46), copied from its spawn. */
  readonly behavior: ObjectBehavior;
  /** The cosmetic effect it trails (#47), if its spawn names one; for views only. */
  readonly effect?: EffectId;
}

export interface PlatformDef {
  readonly bounds: Rect;
  /** Pass-through platforms can be jumped through from below and dropped through by holding down. */
  readonly passThrough: boolean;
}

/**
 * A corner of a solid platform a fighter can hang from (#40). `facing` is the way a fighter on it
 * faces: onto the stage, so 1 on a platform's left corner and -1 on its right one.
 */
export interface LedgeDef {
  readonly position: Vec2;
  readonly facing: 1 | -1;
}

export interface StageDef {
  readonly id: string;
  readonly name: string;
  readonly platforms: readonly PlatformDef[];
  readonly spawnPoints: readonly Vec2[];
  /** Corners of solid platforms fighters can hang from; one fighter per ledge. */
  readonly ledges: readonly LedgeDef[];
  /** Leaving this rectangle loses a stock. */
  readonly blastZone: Rect;
}

/**
 * What a defence made of a hit: a block (#50) `blocked` it or was `broken` by it, or a counter
 * (#51) `countered` it.
 */
export type GuardOutcome = 'blocked' | 'broken' | 'countered';

export type GameEvent =
  | {
      readonly type: 'hit';
      readonly attacker: PlayerSlot;
      readonly target: PlayerSlot;
      /** Damage percent this hit dealt. */
      readonly damage: number;
      /** Where it struck (#48): the centre of the hitbox or object that hit. */
      readonly position: Vec2;
      /**
       * Launch speed it gave the target, in units per frame: how hard it was. For a blocked hit,
       * the speed it pushed the blocker back.
       */
      readonly launch: number;
      /** Whether a block (#50) or a counter (#51) met it; left out for a plain hit. */
      readonly guard?: GuardOutcome;
    }
  | {
      readonly type: 'ko';
      readonly slot: PlayerSlot;
      /** Lives left after this KO; null in a time match, where lives don't count. */
      readonly stocksLeft: number | null;
      /** Where the fighter left the blast zone (#48), on its edge. */
      readonly position: Vec2;
    }
  | { readonly type: 'match-end'; readonly winner: PlayerSlot | null };

/** `countdown`: READY is shown and fighters wait for GO (`goFrame`). */
export type MatchPhase = 'countdown' | 'playing' | 'finished';

export type RuleMode = 'stock' | 'time';

/** How a match is won. Chosen on the options screen. */
export interface MatchRules {
  /** Stock: last one with lives left wins. Time: best score (KOs minus falls) when time is up. */
  readonly mode: RuleMode;
  /** Lives per player in stock mode. */
  readonly stocks: number;
  /** Match length in time mode. */
  readonly timeLimitSeconds: number;
}

export interface MatchState {
  readonly frame: number;
  readonly phase: MatchPhase;
  /** The frame play starts on (GO). Before it the match is in its countdown. */
  readonly goFrame: number;
  readonly stage: StageDef;
  readonly rules: MatchRules;
  readonly fighters: readonly FighterState[];
  /** Objects moves spawned that are still around (#45), in spawn order. */
  readonly objects: readonly SpawnedObject[];
  /** The id the next spawned object gets. */
  readonly nextObjectId: number;
  /** Events produced by the most recent step only. */
  readonly events: readonly GameEvent[];
  readonly winner: PlayerSlot | null;
  /** Present only in training mode (#144): the dummy's settings and what the HUD measures. */
  readonly training?: TrainingState;
}

/**
 * How an aerial ended on landing (#149): within an auto-cancel window (#148), or between them
 * with or without an L-cancel.
 */
export type AerialLanding = 'autoCancelled' | 'lCancelled' | 'missed';

/** What the training dummy does on its own (#144). */
export type DummyBehaviour = 'stand' | 'crouch' | 'jump' | 'dodge';

/**
 * The stick the dummy holds when hit (#154): none, survival DI (towards the stage's centre and
 * up) or combo DI (away from the attacker and down).
 */
export type DummyDi = 'none' | 'survival' | 'combo';

/** Set in the training panel; the session applies them between frames. */
export interface TrainingSettings {
  /** The slot the dummy plays; it ignores that slot's input. */
  readonly dummy: PlayerSlot;
  readonly behaviour: DummyBehaviour;
  readonly di: DummyDi;
  /** The dummy's damage after a reset or a change here. */
  readonly percent: number;
  /** Holds the dummy at `percent`, so every try of a combo starts the same. */
  readonly freezePercent: boolean;
}

/**
 * Follows one hit until attacker and dummy can both act again, to measure frame advantage:
 * frames since the hit, and the frame each became free (null while still busy).
 */
export interface AdvantageWatch {
  readonly attacker: PlayerSlot;
  /** The move that hit, and its frame last step: the attacker is busy while it plays on. */
  readonly moveId: MoveId | null;
  readonly moveFrame: number;
  readonly frames: number;
  readonly attackerFree: number | null;
  readonly targetFree: number | null;
}

/** Training mode's settings and measurements (#144). Plain data like the rest of the state. */
export interface TrainingState {
  readonly settings: TrainingSettings;
  /** Hits and damage of the current combo, or of the last one once `comboActive` is false. */
  readonly comboHits: number;
  readonly comboDamage: number;
  /** The dummy is still in hitstun from the combo, so the next hit adds to it. */
  readonly comboActive: boolean;
  /** Frames the attacker could act before the dummy after the last measured hit. */
  readonly advantage: number | null;
  readonly watch: AdvantageWatch | null;
  /** The move the first player played last, for its frame data on the HUD. */
  readonly lastMove: MoveId | null;
}

/**
 * How a character moves and how hard it is to launch. Units as in `config.ts`: stage units and
 * frames. The capsule's are `FIGHTER`; other characters start from them and change what differs.
 */
export interface CharacterStats {
  /** The body box for stage collision, around the feet. */
  readonly width: number;
  readonly height: number;
  /** Top walking speed, at a full but slowly pushed stick; a partly tilted stick walks slower. */
  readonly walkSpeed: number;
  /**
   * The Melee-style dash (#146): a sideways flick of the stick dashes at `dashSpeed` for
   * `initialDashFrames`; a flick back during it dashes the other way (dash dance). Held past it,
   * the fighter runs at `runSpeed`. A run stopped (stick let go) or turned (stick pushed back)
   * brakes to a halt over `skidFrames`.
   */
  readonly initialDashFrames: number;
  readonly dashSpeed: number;
  readonly runSpeed: number;
  readonly skidFrames: number;
  readonly groundAcceleration: number;
  readonly groundFriction: number;
  /** Top drift speed in the air. */
  readonly airSpeed: number;
  readonly airAcceleration: number;
  readonly airFriction: number;
  readonly gravity: number;
  readonly maxFallSpeed: number;
  readonly fastFallSpeed: number;
  /**
   * Frames crouched on the ground before a jump leaves it; a ground attack can start instead.
   * Keep it below `STICK.smashWindowFrames`, so a stick flicked up (which tap-jumps) and attack
   * pressed on the last squat frame is still an up smash.
   */
  readonly jumpSquatFrames: number;
  /** Take-off speed of the ground jump and of an air jump; they set the jump heights. */
  readonly jumpVelocity: number;
  readonly airJumpVelocity: number;
  /** Take-off speed of a ground jump from the short hop button (#147): about 30 frames up. */
  readonly shortHopVelocity: number;
  /** Jumps in the air after leaving the ground (Melee's double jump is 1); landing resets them. */
  readonly airJumps: number;
  /**
   * In Melee's units (Mario 100): the percent part of knockback is scaled by
   * `200 / (weight + 100)`, so heavier characters fly less far (#153).
   */
  readonly weight: number;
  /** Landing lag after a jump or fall without an aerial running; aerials set their own. */
  readonly landingLagFrames: number;
}

/**
 * A pickable fighter, entirely as plain data (#37): its stats, the body its poses, hurtboxes and
 * bone hitboxes are built on, and the move each slot plays. How it looks is the view's business.
 */
export interface CharacterDef {
  readonly id: string;
  readonly name: string;
  readonly stats: CharacterStats;
  /** Bone lengths and thickness; every skeleton has every `BoneId`, so poses fit any body. */
  readonly skeleton: SkeletonDef;
  /** The move each slot plays (`move-slots.ts`); an empty slot does nothing. */
  readonly moves: Readonly<Partial<Record<MoveSlot, MoveId>>>;
}

export interface PlayerConfig {
  /** Registry id, see `CHARACTERS`. */
  readonly characterId: string;
}

/** What the menus hand to the core to start a match. Ids refer to the registry. */
export interface MatchConfig {
  /** Registry id, see `STAGES`. */
  readonly stageId: string;
  /** One entry per player, in slot order. */
  readonly players: readonly PlayerConfig[];
  readonly rules: MatchRules;
  /** Frames of READY before GO; `COUNTDOWN.frames` by default, 0 to start playing at once. */
  readonly countdownFrames?: number;
  /**
   * Makes the match a training session (#144): no stocks and no clock, KOs respawn, and the
   * dummy acts on its own.
   */
  readonly training?: TrainingSettings;
}
