import { FIGHTER, HITSTUN_PER_KNOCKBACK, JAB, type AttackDef } from './config';
import { circleIntersectsRect, type Rect, type Vec2 } from './math';
import type { FighterState, GameEvent } from './types';

export interface Hitbox {
  readonly center: Vec2;
  readonly radius: number;
  readonly attack: AttackDef;
}

/** The fighter's active hitbox this frame, if any. Exported so renderers can visualise it. */
export const activeHitbox = (fighter: FighterState): Hitbox | null => {
  if (fighter.action !== 'jab') return null;
  const { actionFrame } = fighter;
  if (actionFrame < JAB.startupFrames || actionFrame >= JAB.startupFrames + JAB.activeFrames) {
    return null;
  }
  return {
    center: {
      x: fighter.position.x + JAB.offsetX * fighter.facing,
      y: fighter.position.y + JAB.offsetY,
    },
    radius: JAB.radius,
    attack: JAB,
  };
};

export const hurtbox = (fighter: FighterState): Rect => ({
  left: fighter.position.x - FIGHTER.width / 2,
  right: fighter.position.x + FIGHTER.width / 2,
  bottom: fighter.position.y,
  top: fighter.position.y + FIGHTER.height,
});

/** Launch speed in units per frame. Grows with the target's damage after the hit. */
export const knockback = (attack: AttackDef, damageAfterHit: number, weight: number): number =>
  (attack.baseKnockback + damageAfterHit * attack.knockbackGrowth) / weight;

/**
 * Resolves all hits for this frame. Hits are computed from the same snapshot,
 * so trades (both fighters hitting each other on the same frame) are symmetric.
 */
export const resolveCombat = (
  fighters: readonly FighterState[],
): { fighters: FighterState[]; events: GameEvent[] } => {
  const next = [...fighters];
  const events: GameEvent[] = [];

  for (const attacker of fighters) {
    const hitbox = activeHitbox(attacker);
    if (!hitbox) continue;

    for (const target of fighters) {
      if (target.slot === attacker.slot) continue;
      if (target.action === 'eliminated' || target.invulnerableFrames > 0) continue;
      if (attacker.hitTargets.includes(target.slot)) continue;
      if (!circleIntersectsRect(hitbox.center, hitbox.radius, hurtbox(target))) continue;

      const current = next[target.slot] ?? target;
      const damage = current.damage + hitbox.attack.damage;
      const speed = knockback(hitbox.attack, damage, FIGHTER.weight);
      const radians = (hitbox.attack.angle * Math.PI) / 180;

      next[target.slot] = {
        ...current,
        damage,
        velocity: { x: Math.cos(radians) * speed * attacker.facing, y: Math.sin(radians) * speed },
        grounded: false,
        action: 'hitstun',
        actionFrame: 0,
        hitstunFrames: Math.round(speed * HITSTUN_PER_KNOCKBACK),
        hitTargets: [],
      };
      const attackerNow = next[attacker.slot] ?? attacker;
      next[attacker.slot] = {
        ...attackerNow,
        hitTargets: [...attackerNow.hitTargets, target.slot],
      };
      events.push({ type: 'hit', attacker: attacker.slot, target: target.slot, damage });
    }
  }

  return { fighters: next, events };
};
