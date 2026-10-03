import { characterOf } from './character';
import { HITLAG, HITSTUN_PER_KNOCKBACK } from './config';
import { circleIntersectsCapsule, type Vec2 } from './math';
import { findMove } from './move-data';
import type { HitboxDef } from './moves';
import { plantedBoneSegments, type BoneId } from './skeleton';
import type { FighterState, GameEvent } from './types';

export interface Hitbox {
  readonly center: Vec2;
  readonly radius: number;
  readonly attack: HitboxDef;
}

/** The hitboxes of the fighter's move that are on this frame. Exported so views can draw them. */
export const activeHitboxes = (fighter: FighterState): Hitbox[] => {
  if (fighter.action !== 'attack' || fighter.moveId === null) return [];
  const frame = fighter.actionFrame;
  const on = findMove(fighter.moveId).hitboxes.filter(
    (hitbox) => frame >= hitbox.from && frame < hitbox.to,
  );
  if (on.length === 0) return [];
  // Bone hitboxes sit on the planted body, the one the view draws and hurtboxes use.
  const { skeleton } = characterOf(fighter.characterId);
  const bones = plantedBoneSegments(skeleton, fighter.pose, fighter.position, fighter.facing);
  return on.map((hitbox) => {
    const { anchor } = hitbox;
    if ('bone' in anchor) {
      const { start, end } = bones[anchor.bone];
      const center = {
        x: start.x + (end.x - start.x) * anchor.at,
        y: start.y + (end.y - start.y) * anchor.at,
      };
      return { center, radius: hitbox.radius, attack: hitbox };
    }
    const center = {
      x: fighter.position.x + anchor.feet.x * fighter.facing,
      y: fighter.position.y + anchor.feet.y,
    };
    return { center, radius: hitbox.radius, attack: hitbox };
  });
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
  const { skeleton } = characterOf(fighter.characterId);
  const segments = plantedBoneSegments(skeleton, fighter.pose, fighter.position, fighter.facing);
  return skeleton.bones.map((bone) => {
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

/**
 * The hitbox that strikes `target` this frame, if any: of those touching its body whose group has
 * not hit it yet, the highest priority, then the first in the move's list.
 */
export const strikingHitbox = (
  hitboxes: readonly Hitbox[],
  target: FighterState,
  groupsAlreadyHit: readonly number[],
): Hitbox | undefined => {
  let best: Hitbox | undefined;
  for (const hitbox of hitboxes) {
    if (groupsAlreadyHit.includes(hitbox.attack.group ?? 0)) continue;
    if (best && hitbox.attack.priority <= best.attack.priority) continue;
    if (hitsBody(hitbox, target)) best = hitbox;
  }
  return best;
};

/** Launch speed in units per frame. Grows with the target's damage after the hit. */
export const knockback = (
  attack: Pick<HitboxDef, 'baseKnockback' | 'knockbackGrowth'>,
  damageAfterHit: number,
  weight: number,
): number => (attack.baseKnockback + damageAfterHit * attack.knockbackGrowth) / weight;

/** How long a hit freezes attacker and target: longer for harder hits. */
export const hitlagFrames = (attack: Pick<HitboxDef, 'damage' | 'hitlagScale'>): number =>
  Math.floor(
    (HITLAG.baseFrames + attack.damage / HITLAG.damagePerFrame) * (attack.hitlagScale ?? 1),
  );

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
    const hitboxes = activeHitboxes(attacker);
    if (hitboxes.length === 0) continue;

    for (const target of fighters) {
      if (target.slot === attacker.slot) continue;
      if (target.action === 'eliminated' || target.invulnerableFrames > 0) continue;
      const groupsHit = attacker.hitTargets
        .filter((record) => record.slot === target.slot)
        .map((record) => record.group);
      const hitbox = strikingHitbox(hitboxes, target, groupsHit);
      if (!hitbox) continue;

      const current = next[target.slot] ?? target;
      const damage = current.damage + hitbox.attack.damage;
      const speed = knockback(hitbox.attack, damage, characterOf(current.characterId).stats.weight);
      const radians = (hitbox.attack.angle * Math.PI) / 180;
      const hitlag = hitlagFrames(hitbox.attack);

      next[target.slot] = {
        ...current,
        damage,
        velocity: { x: Math.cos(radians) * speed * attacker.facing, y: Math.sin(radians) * speed },
        grounded: false,
        action: 'hitstun',
        actionFrame: 0,
        // A hit gives the air dodge back, as in Ultimate.
        airDodgeUsed: false,
        moveId: null,
        hitstunFrames: Math.round(speed * HITSTUN_PER_KNOCKBACK),
        // The launch is set now but held until the freeze ends.
        hitlagFrames: Math.max(current.hitlagFrames, hitlag),
        hitTargets: [],
        lastHitBy: attacker.slot,
      };
      const attackerNow = next[attacker.slot] ?? attacker;
      next[attacker.slot] = {
        ...attackerNow,
        hitTargets: [
          ...attackerNow.hitTargets,
          { slot: target.slot, group: hitbox.attack.group ?? 0 },
        ],
        damageDealt: attackerNow.damageDealt + hitbox.attack.damage,
        hitlagFrames: Math.max(attackerNow.hitlagFrames, hitlag),
      };
      events.push({ type: 'hit', attacker: attacker.slot, target: target.slot, damage });
    }
  }

  return { fighters: next, events };
};
