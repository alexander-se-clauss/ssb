import { characterOf } from './character';
import { CROUCH, HITLAG, KNOCKBACK } from './config';
import { isCrouching } from './crouch';
import { damageScale, queueBefore, queueMove, staled } from './stale';
import { circleIntersectsCapsule, type Vec2 } from './math';
import { findMove } from './move-data';
import {
  moveTiming,
  type CounterDef,
  type EffectId,
  type GuardDef,
  type HitboxAnchor,
  type HitboxDef,
  type HitDef,
} from './moves';
import { plantedBoneSegments, type BoneId } from './skeleton';
import type { FighterState, GameEvent, GuardOutcome, PlayerSlot } from './types';

export interface Hitbox {
  readonly center: Vec2;
  readonly radius: number;
  readonly attack: HitboxDef;
}

/** Where an anchor (a bone point, or a spot relative to the feet) is on the fighter's body now. */
const anchorPoints = (fighter: FighterState): ((anchor: HitboxAnchor) => Vec2) => {
  // Bone anchors sit on the planted body, the one the view draws and hurtboxes use.
  const { skeleton } = characterOf(fighter.characterId);
  const bones = plantedBoneSegments(skeleton, fighter.pose, fighter.position, fighter.facing);
  return (anchor) => {
    if ('bone' in anchor) {
      const { start, end } = bones[anchor.bone];
      return {
        x: start.x + (end.x - start.x) * anchor.at,
        y: start.y + (end.y - start.y) * anchor.at,
      };
    }
    return {
      x: fighter.position.x + anchor.feet.x * fighter.facing,
      y: fighter.position.y + anchor.feet.y,
    };
  };
};

/** The hitboxes of the fighter's move that are on this frame. Exported so views can draw them. */
export const activeHitboxes = (fighter: FighterState): Hitbox[] => {
  if (fighter.action !== 'attack' || fighter.moveId === null) return [];
  const frame = fighter.actionFrame;
  const on = findMove(fighter.moveId).hitboxes.filter(
    (hitbox) => frame >= hitbox.from && frame < hitbox.to,
  );
  if (on.length === 0) return [];
  const at = anchorPoints(fighter);
  return on.map((hitbox) => ({ center: at(hitbox.anchor), radius: hitbox.radius, attack: hitbox }));
};

/** A cosmetic effect of the current move, by id, and where on the body it is this frame. */
export interface ActiveEffect {
  readonly effect: EffectId;
  readonly position: Vec2;
}

/**
 * The effects the fighter's move shows this frame (#47), such as fire on a fist. Only views read
 * them: they never feed back into the game, and core knows them only by id.
 */
export const activeEffects = (fighter: FighterState): ActiveEffect[] => {
  if (fighter.action !== 'attack' || fighter.moveId === null) return [];
  const frame = fighter.actionFrame;
  const on = (findMove(fighter.moveId).effects ?? []).filter(
    (key) => frame >= key.from && frame < key.to,
  );
  if (on.length === 0) return [];
  const at = anchorPoints(fighter);
  return on.map((key) => ({ effect: key.effect, position: at(key.anchor) }));
};

/** The fighter's guard this frame (#50): its block's guard, on its guard frames, on the ground. */
export const activeGuard = (fighter: FighterState): GuardDef | undefined => {
  if (fighter.action !== 'attack' || fighter.moveId === null || !fighter.grounded) return undefined;
  const { guard } = findMove(fighter.moveId);
  const frame = fighter.actionFrame;
  return guard && frame >= guard.from && frame < guard.to ? guard : undefined;
};

/** The fighter's counter this frame (#51): its counter move's, on the window frames. */
export const activeCounter = (fighter: FighterState): CounterDef | undefined => {
  if (fighter.action !== 'attack' || fighter.moveId === null) return undefined;
  const { counter } = findMove(fighter.moveId);
  const frame = fighter.actionFrame;
  return counter && frame >= counter.from && frame < counter.to ? counter : undefined;
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

/** Whether a circle (a hitbox, a spawned object) touches any of the target's hurtboxes. */
export const touchesBody = (center: Vec2, radius: number, target: FighterState): boolean =>
  hurtboxes(target).some((box) =>
    circleIntersectsCapsule(center, radius, box.start, box.end, box.radius),
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
    if (touchesBody(hitbox.center, hitbox.radius, target)) best = hitbox;
  }
  return best;
};

/**
 * A hit's knockback in Melee's units (#153, `KNOCKBACK` in config): grows with the target's
 * percent after the hit and the hit's damage, by the move's growth, on top of its base, and
 * shrinks with the target's weight.
 */
export const knockback = (
  attack: Pick<HitDef, 'damage' | 'baseKnockback' | 'knockbackGrowth'>,
  damageAfterHit: number,
  weight: number,
): number => {
  const p = damageAfterHit;
  const scaled = (p / 10 + (p * attack.damage) / 20) * (200 / (weight + 100)) * 1.4 + 18;
  return (scaled * attack.knockbackGrowth) / 100 + attack.baseKnockback;
};

/** The launch speed of `units` of knockback, in stage units per frame. */
export const launchSpeed = (units: number): number => units * KNOCKBACK.speedPerUnit;

/** The hitstun frames of `units` of knockback, as in Melee. */
export const hitstunOf = (units: number): number => Math.floor(units * KNOCKBACK.hitstunPerUnit);

/** How long a hit freezes attacker and target: longer for harder hits. */
export const hitlagFrames = (attack: Pick<HitDef, 'damage' | 'hitlagScale'>): number =>
  Math.floor(
    (HITLAG.baseFrames + attack.damage / HITLAG.damagePerFrame) * (attack.hitlagScale ?? 1),
  );

/** What a hit did: the target after it, the freeze, the launch and the damage it dealt. */
export interface HitResult {
  readonly target: FighterState;
  readonly hitlag: number;
  readonly launch: number;
  readonly damage: number;
  readonly guard?: GuardOutcome;
}

/**
 * `target` struck by `hit`, launched with `direction` as forward, and credited to `by`; with the
 * freeze the hit causes. A fighter's hitbox and a spawned object (#45) hit the same way.
 * A block (#50) takes a hit that comes `from` in front of it (the attacker's feet, or the
 * object): less damage and a push back instead of a launch, unless the hit breaks it.
 */
export const applyHit = (
  target: FighterState,
  hit: HitDef,
  direction: 1 | -1,
  by: PlayerSlot,
  from: Vec2,
): HitResult => {
  const { stats } = characterOf(target.characterId);
  const hitlag = hitlagFrames(hit);
  const counter = activeCounter(target);
  if (counter) {
    // Countered (#51): no damage; the fighter turns to the hit and strikes back, out of reach
    // until its counterattack is done.
    const strike = moveTiming(findMove(counter.into));
    const facing =
      from.x === target.position.x ? target.facing : from.x > target.position.x ? 1 : -1;
    return {
      hitlag,
      launch: 0,
      damage: 0,
      guard: 'countered',
      target: {
        ...target,
        facing,
        // Set after this frame's update, so the counterattack plays from its frame 1 on, as
        // hitstun starts counting after the hit.
        actionFrame: 0,
        moveId: counter.into,
        hitTargets: [],
        hitlagFrames: Math.max(target.hitlagFrames, hitlag),
        // Invulnerability does not run down in hitlag, so the freeze needs no extra frames.
        invulnerableFrames: Math.max(
          target.invulnerableFrames,
          strike.startupFrames + strike.activeFrames,
        ),
      },
    };
  }
  const guard = activeGuard(target);
  const fromFront = (from.x - target.position.x) * target.facing >= 0;
  if (guard && fromFront && hit.damage < guard.breakDamage) {
    const damage = hit.damage * guard.damageScale;
    // By the hit alone, not the blocker's percent, so a guard at 120% slides no further.
    const push = launchSpeed(knockback(hit, hit.damage, stats.weight)) * guard.pushback;
    return {
      hitlag,
      launch: push,
      damage,
      guard: 'blocked',
      target: {
        ...target,
        damage: target.damage + damage,
        // Pushed straight back along the ground, the guard still up.
        velocity: { x: -target.facing * push, y: target.velocity.y - target.knockback.y },
        knockback: { x: 0, y: 0 },
        hitlagFrames: Math.max(target.hitlagFrames, hitlag),
        lastHitBy: by,
      },
    };
  }
  const broken = guard !== undefined && fromFront;
  const damage = target.damage + hit.damage;
  // Crouch cancel (#156): a crouch takes part of the knockback, and below a tumble the ground
  // holds the fighter, which only slides back along it.
  const crouched = isCrouching(target);
  const units = knockback(hit, damage, stats.weight) * (crouched ? CROUCH.knockbackScale : 1);
  const tumbling = units >= KNOCKBACK.tumbleFrom;
  const grounded = crouched && !tumbling;
  const speed = launchSpeed(units);
  const radians = (hit.angle * Math.PI) / 180;
  const launch = grounded
    ? { x: Math.cos(radians) * speed * direction, y: 0 }
    : { x: Math.cos(radians) * speed * direction, y: Math.sin(radians) * speed };
  return {
    hitlag,
    launch: speed,
    damage: hit.damage,
    ...(broken && { guard: 'broken' as const }),
    target: {
      ...target,
      damage,
      // All of it is launch: the fighter's own speed starts again from nothing.
      velocity: launch,
      knockback: launch,
      tumbling,
      grounded,
      // Launched off the ground, the ground jump is gone; the air jumps stay.
      jumpsRemaining: grounded
        ? target.jumpsRemaining
        : Math.min(target.jumpsRemaining, stats.airJumps),
      action: 'hitstun',
      actionFrame: 0,
      // Knocked off a ledge it held.
      ledge: null,
      // A hit gives the air dodge back, as in Ultimate.
      airDodgeUsed: false,
      moveId: null,
      hitstunFrames: hitstunOf(units) + (broken ? guard.breakStun : 0),
      // The launch is set now but held until the freeze ends.
      hitlagFrames: Math.max(target.hitlagFrames, hitlag),
      hitTargets: [],
      lastHitBy: by,
    },
  };
};

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
      // As it is now: a counter (#51) another attacker set off this frame already protects it.
      const now = next[target.slot] ?? target;
      if (target.action === 'eliminated' || now.invulnerableFrames > 0) continue;
      const groupsHit = attacker.hitTargets
        .filter((record) => record.slot === target.slot)
        .map((record) => record.group);
      const hitbox = strikingHitbox(hitboxes, target, groupsHit);
      if (!hitbox) continue;

      // Stale moves (#157): a use of a move joins the queue on its first hit, so its later hits
      // are scaled by the queue as it was before that use.
      const firstHit = attacker.hitTargets.length === 0;
      const { moveId } = attacker;
      const scale =
        moveId === null
          ? 1
          : damageScale(queueBefore(attacker.staleMoves, moveId, firstHit), moveId);
      const result = applyHit(
        now,
        staled(hitbox.attack, scale),
        attacker.facing,
        attacker.slot,
        attacker.position,
      );
      const { hitlag, damage } = result;
      next[target.slot] = result.target;
      const attackerNow = next[attacker.slot] ?? attacker;
      next[attacker.slot] = {
        ...attackerNow,
        // Once per use, also when it hits two fighters on the same frame; not when countered.
        staleMoves:
          firstHit &&
          moveId !== null &&
          result.guard !== 'countered' &&
          attackerNow.staleMoves === attacker.staleMoves
            ? queueMove(attacker.staleMoves, moveId)
            : attackerNow.staleMoves,
        hitTargets: [
          ...attackerNow.hitTargets,
          { slot: target.slot, group: hitbox.attack.group ?? 0 },
        ],
        damageDealt: attackerNow.damageDealt + damage,
        hitlagFrames: Math.max(attackerNow.hitlagFrames, hitlag),
      };
      events.push({
        type: 'hit',
        attacker: attacker.slot,
        target: target.slot,
        damage,
        position: hitbox.center,
        launch: result.launch,
        ...(result.guard && { guard: result.guard }),
      });
    }
  }

  return { fighters: next, events };
};
