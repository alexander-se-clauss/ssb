import { FIGHTER, HITSTUN_PER_KNOCKBACK, JAB, type AttackDef } from './config';
import { circleIntersectsCapsule, type Vec2 } from './math';
import { HUMANOID, plantedBoneSegments, type BoneId } from './skeleton';
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

/**
 * Where one body part can be hit: every point within `radius` of the segment `start` to `end`
 * (a ball when they meet). It has exactly the size and place of the drawn part.
 */
export interface Hurtbox {
  readonly bone: BoneId;
  readonly start: Vec2;
  readonly end: Vec2;
  readonly radius: number;
}

/**
 * One hurtbox per bone, on the same planted body the view draws, so a crouch or a lean dodges
 * exactly what it looks like it dodges.
 */
export const hurtboxes = (fighter: FighterState): Hurtbox[] => {
  const segments = plantedBoneSegments(HUMANOID, fighter.pose, fighter.position, fighter.facing);
  return HUMANOID.bones.map((bone) => {
    const { start, end } = segments[bone.id];
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    // A capsule's round ends stay within its joints, as drawn: the core segment is inset by the
    // radius at both ends (a ball keeps only the middle).
    const half = bone.shape === 'capsule' ? Math.max(bone.length / 2 - bone.radius, 0) : 0;
    const t = bone.length === 0 ? 0 : half / bone.length;
    const at = (sign: number) => ({
      x: middle.x + (end.x - start.x) * t * sign,
      y: middle.y + (end.y - start.y) * t * sign,
    });
    return { bone: bone.id, start: at(-1), end: at(1), radius: bone.radius };
  });
};

const hitsBody = (hitbox: Hitbox, target: FighterState): boolean =>
  hurtboxes(target).some((box) =>
    circleIntersectsCapsule(hitbox.center, hitbox.radius, box.start, box.end, box.radius),
  );

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
      if (!hitsBody(hitbox, target)) continue;

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
        lastHitBy: attacker.slot,
      };
      const attackerNow = next[attacker.slot] ?? attacker;
      next[attacker.slot] = {
        ...attackerNow,
        hitTargets: [...attackerNow.hitTargets, target.slot],
        damageDealt: attackerNow.damageDealt + hitbox.attack.damage,
      };
      events.push({ type: 'hit', attacker: attacker.slot, target: target.slot, damage });
    }
  }

  return { fighters: next, events };
};
