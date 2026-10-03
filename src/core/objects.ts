/**
 * Spawned objects (#45): things a move leaves in the match, such as a projectile. They are plain
 * data in `MatchState.objects`, step with the match, hit fighters other than their owner, and are
 * gone on a hit, when their lifetime ends, or outside the blast zone.
 */
import { applyHit, touchesBody } from './combat';
import { findMove } from './move-data';
import type { SpawnDef } from './moves';
import type { Rect } from './math';
import type { FighterState, GameEvent, SpawnedObject } from './types';

/** The spawns `after` reached this frame: its move's ones on the move frame it just played. */
const reachedSpawns = (before: FighterState, after: FighterState): readonly SpawnDef[] => {
  if (after.action !== 'attack' || after.moveId === null) return [];
  // A frozen fighter (hitlag) stays on its frame; it only reaches a frame by playing it.
  const stood =
    before.action === 'attack' &&
    before.moveId === after.moveId &&
    before.actionFrame === after.actionFrame;
  if (stood) return [];
  return (findMove(after.moveId).spawns ?? []).filter((spawn) => spawn.frame === after.actionFrame);
};

/**
 * The objects the fighters' moves spawn this frame, numbered from `nextId` in slot order.
 * `before` and `after` are the fighters at the start of the frame and after their update.
 */
export const spawnObjects = (
  before: readonly FighterState[],
  after: readonly FighterState[],
  nextId: number,
): SpawnedObject[] => {
  const spawned: SpawnedObject[] = [];
  after.forEach((fighter, index) => {
    const previous = before[index];
    if (!previous) return;
    for (const spawn of reachedSpawns(previous, fighter)) {
      const { facing } = fighter;
      spawned.push({
        id: nextId + spawned.length,
        owner: fighter.slot,
        position: {
          x: fighter.position.x + spawn.offset.x * facing,
          y: fighter.position.y + spawn.offset.y,
        },
        velocity: { x: spawn.velocity.x * facing, y: spawn.velocity.y },
        facing,
        age: 0,
        lifetime: spawn.lifetime,
        radius: spawn.radius,
        hit: spawn.hit,
      });
    }
  });
  return spawned;
};

/** Whether the object is inside the blast zone; outside it, it is gone. */
export const insideZone = (object: SpawnedObject, zone: Rect): boolean => {
  const { x, y } = object.position;
  return x >= zone.left && x <= zone.right && y >= zone.bottom && y <= zone.top;
};

/** Objects one frame on: moved by their velocity and aged, without those whose time is up. */
export const moveObjects = (objects: readonly SpawnedObject[], blastZone: Rect): SpawnedObject[] =>
  objects
    .map((object) => ({
      ...object,
      age: object.age + 1,
      position: {
        x: object.position.x + object.velocity.x,
        y: object.position.y + object.velocity.y,
      },
    }))
    .filter((object) => object.age < object.lifetime && insideZone(object, blastZone));

/**
 * Lets each object hit the first fighter it touches (in slot order) that is not its owner and
 * can be hit. A hit launches the target the way the object's owner faced when it spawned it,
 * freezes only the target, credits the owner, and uses the object up.
 */
export const resolveObjectHits = (
  objects: readonly SpawnedObject[],
  fighters: readonly FighterState[],
): { objects: SpawnedObject[]; fighters: FighterState[]; events: GameEvent[] } => {
  const next = [...fighters];
  const events: GameEvent[] = [];
  const left = objects.filter((object) => {
    const target = next.find(
      (fighter) =>
        fighter.slot !== object.owner &&
        fighter.action !== 'eliminated' &&
        fighter.invulnerableFrames === 0 &&
        touchesBody(object.position, object.radius, fighter),
    );
    if (!target) return true;
    const { target: struck } = applyHit(target, object.hit, object.facing, object.owner);
    next[target.slot] = struck;
    const owner = next[object.owner];
    if (owner) {
      next[object.owner] = { ...owner, damageDealt: owner.damageDealt + object.hit.damage };
    }
    events.push({
      type: 'hit',
      attacker: object.owner,
      target: target.slot,
      damage: struck.damage,
    });
    return false;
  });
  return { objects: left, fighters: next, events };
};
