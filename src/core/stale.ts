/**
 * Stale moves (#157), as in Melee: the more often and the more recently a move hit, the less
 * damage (and so knockback) it deals; a move not used lately deals a little more.
 */
import { STALE } from './config';
import type { HitDef, MoveId } from './moves';

/** The factor on `moveId`'s damage, given the fighter's queue of recent hits, newest first. */
export const damageScale = (queue: readonly MoveId[], moveId: MoveId): number => {
  const copies = queue.flatMap((id, i) => (id === moveId ? [STALE.weights[i] ?? 0] : []));
  return copies.length === 0
    ? STALE.freshBonus
    : copies.reduce((scale, weight) => scale - weight, 1);
};

/** The queue once `moveId` hit: in front, the oldest falling off the end. */
export const queueMove = (queue: readonly MoveId[], moveId: MoveId): readonly MoveId[] =>
  [moveId, ...queue].slice(0, STALE.queueLength);

/**
 * The queue a hit of `moveId` is scaled by. A use joins the queue on its first hit, so its later
 * hits leave that entry out: the newest copy of the move, as another hit (a shot) may have gone
 * in front of it since.
 */
export const queueBefore = (
  queue: readonly MoveId[],
  moveId: MoveId,
  firstHit: boolean,
): readonly MoveId[] => {
  const own = firstHit ? -1 : queue.indexOf(moveId);
  return own < 0 ? queue : [...queue.slice(0, own), ...queue.slice(own + 1)];
};

/** `hit` with its damage scaled for staleness. */
export const staled = (hit: HitDef, scale: number): HitDef => ({
  ...hit,
  damage: hit.damage * scale,
});
