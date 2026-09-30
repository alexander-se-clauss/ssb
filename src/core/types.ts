/**
 * Serializable game data. Everything in here must be plain data (no classes, no functions)
 * so it can be cloned, hashed, stored as a replay and sent over the network unchanged.
 */
import type { Rect, Vec2 } from './math';

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
  readonly shield: boolean;
}

export type FighterAction = 'idle' | 'run' | 'airborne' | 'jab' | 'hitstun' | 'eliminated';

export interface FighterState {
  readonly slot: PlayerSlot;
  /** Registry id of the character this fighter plays. */
  readonly characterId: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly facing: 1 | -1;
  readonly grounded: boolean;
  readonly jumpsRemaining: number;
  readonly action: FighterAction;
  /** Frames spent in the current action. */
  readonly actionFrame: number;
  /** Damage percent. Higher damage means stronger knockback. */
  readonly damage: number;
  readonly stocks: number;
  readonly hitstunFrames: number;
  readonly invulnerableFrames: number;
  /** Slots already hit by the current attack, so one swing hits each target only once. */
  readonly hitTargets: readonly PlayerSlot[];
  /** Input of the previous frame, used for press (edge) detection inside the simulation. */
  readonly previousInput: PlayerInput;
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
  | { readonly type: 'ko'; readonly slot: PlayerSlot; readonly stocksLeft: number }
  | { readonly type: 'match-end'; readonly winner: PlayerSlot | null };

export type MatchPhase = 'playing' | 'finished';

export interface MatchState {
  readonly frame: number;
  readonly phase: MatchPhase;
  readonly stage: StageDef;
  readonly fighters: readonly FighterState[];
  /** Events produced by the most recent step only. */
  readonly events: readonly GameEvent[];
  readonly winner: PlayerSlot | null;
}

/** A pickable fighter. Stats and moves join this as characters get their own (epic #7). */
export interface CharacterDef {
  readonly id: string;
  readonly name: string;
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
  readonly stocks: number;
}
