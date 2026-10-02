/**
 * Serializable game data. Everything in here must be plain data (no classes, no functions)
 * so it can be cloned, hashed, stored as a replay and sent over the network unchanged.
 */
import type { Rect, Vec2 } from './math';
import type { StickTracker } from './attack-input';
import type { MoveSlot } from './move-slots';
import type { BufferedAction, MoveId } from './moves';
import type { Pose } from './skeleton';

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
  /** The Start button. Menus use it; the simulation ignores it. */
  readonly start: boolean;
}

export type FighterAction =
  | 'idle'
  | 'run'
  | 'jumpsquat'
  | 'airborne'
  | 'landing'
  | 'attack'
  | 'sidestepIn'
  | 'sidestepOut'
  | 'forwardRoll'
  | 'backRoll'
  | 'airDodge'
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
  readonly velocity: Vec2;
  readonly facing: 1 | -1;
  readonly grounded: boolean;
  readonly jumpsRemaining: number;
  /** The facing before the stick last turned the fighter, and frames since (`DODGE.turnGraceFrames`). */
  readonly turnedFrom: { readonly facing: 1 | -1; readonly age: number } | null;
  /** The air dodge is used up until the fighter lands or is hit (#36). */
  readonly airDodgeUsed: boolean;
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
  /** Who hit this fighter last since it respawned; gets the KO credit. */
  readonly lastHitBy: PlayerSlot | null;
  readonly hitstunFrames: number;
  /** Frames left in the `landing` action: an aerial's landing lag, or the normal one. */
  readonly landingLagFrames: number;
  /** Frames left frozen by a hit (ADR 0006): nothing moves, the move and pose stand still. */
  readonly hitlagFrames: number;
  readonly invulnerableFrames: number;
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

export interface PlatformDef {
  readonly bounds: Rect;
  /** Pass-through platforms can be jumped through from below and dropped through by holding down. */
  readonly passThrough: boolean;
}

export interface StageDef {
  readonly id: string;
  readonly name: string;
  readonly platforms: readonly PlatformDef[];
  readonly spawnPoints: readonly Vec2[];
  /** Leaving this rectangle loses a stock. */
  readonly blastZone: Rect;
}

export type GameEvent =
  | {
      readonly type: 'hit';
      readonly attacker: PlayerSlot;
      readonly target: PlayerSlot;
      readonly damage: number;
    }
  | {
      readonly type: 'ko';
      readonly slot: PlayerSlot;
      /** Lives left after this KO; null in a time match, where lives don't count. */
      readonly stocksLeft: number | null;
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
  /** Events produced by the most recent step only. */
  readonly events: readonly GameEvent[];
  readonly winner: PlayerSlot | null;
}

/** A pickable fighter. Stats and moves join this as characters get their own (epic #7). */
export interface CharacterDef {
  readonly id: string;
  readonly name: string;
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
}
