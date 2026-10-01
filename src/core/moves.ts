/**
 * Moves as plain data (ADR 0006): a move is a `MoveDef`, and one move runner plays any of them.
 * Fighters store only the move's id and frame, never the definition, so state stays small and
 * serializable.
 */
import type { Vec2 } from './math';

export type MoveId = string;

/** Where a hitbox sits. Relative to the feet, x mirrored by facing; bone anchors come with #29. */
export type HitboxAnchor = { readonly feet: Vec2 };

export interface HitboxDef {
  readonly anchor: HitboxAnchor;
  readonly radius: number;
  /** First active frame of the move. */
  readonly from: number;
  /** First frame after the active ones. */
  readonly to: number;
  readonly priority: number;
  readonly damage: number;
  /** Launch angle in degrees, 0 = straight forward, 90 = straight up. */
  readonly angle: number;
  readonly baseKnockback: number;
  /** Extra knockback per percent of the target's damage. */
  readonly knockbackGrowth: number;
}

export interface AttackMoveDef {
  readonly kind: 'attack';
  readonly id: MoveId;
  /** The move runs from frame 0 to `totalFrames - 1`, then the fighter is free again. */
  readonly totalFrames: number;
  readonly hitboxes: readonly HitboxDef[];
}

/** Block and counter moves join this union with #6. */
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
  move.hitboxes.forEach((hitbox, index) => {
    const { from, to } = hitbox;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) {
      fail(`hitbox ${index} has an empty or broken window [${from}, ${to})`);
    }
    if (to > move.totalFrames) fail(`hitbox ${index} ends after the move (${to})`);
    if (!(hitbox.radius > 0)) fail(`hitbox ${index} needs a positive radius`);
  });
};
