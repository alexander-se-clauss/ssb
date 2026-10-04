/**
 * Spawned objects (#45): things a move leaves in the match, such as a projectile. They are plain
 * data in `MatchState.objects`, step with the match by their behaviour (#46), hit fighters other
 * than their owner, and are gone on a hit, when their lifetime ends, or outside the blast zone.
 */
import { characterOf } from './character';
import { applyHit, touchesBody } from './combat';
import { findMove } from './move-data';
import type { ObjectBehavior, SpawnDef } from './moves';
import type { Rect, Vec2 } from './math';
import type { FighterState, GameEvent, PlatformDef, SpawnedObject, StageDef } from './types';

const STRAIGHT: ObjectBehavior = { kind: 'straight' };

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
      const behavior = spawn.behavior ?? STRAIGHT;
      const velocity = { x: spawn.velocity.x * facing, y: spawn.velocity.y };
      spawned.push({
        id: nextId + spawned.length,
        owner: fighter.slot,
        position: {
          x: fighter.position.x + spawn.offset.x * facing,
          y: fighter.position.y + spawn.offset.y,
        },
        velocity,
        launchVelocity: velocity,
        facing,
        age: 0,
        lifetime: spawn.lifetime,
        radius: spawn.radius,
        hit: spawn.hit,
        behavior,
        ...(spawn.effect !== undefined && { effect: spawn.effect }),
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

/** Whether a returning object is on its way back (#46). */
const returning = (object: SpawnedObject): boolean =>
  object.behavior.kind === 'return' && object.age > object.behavior.turnFrames;

/**
 * The speed an object moves by on its frame `age` (counting from 1), by its behaviour (#46).
 * `owner` is the fighter that spawned it, for a returning object to fly back to.
 */
const nextVelocity = (
  object: SpawnedObject,
  age: number,
  owner: FighterState | undefined,
): Vec2 => {
  const { behavior, velocity, launchVelocity } = object;
  switch (behavior.kind) {
    case 'straight':
      return velocity;
    case 'trap':
      return { x: 0, y: 0 };
    case 'arc':
      return { x: velocity.x, y: velocity.y - behavior.gravity };
    case 'return': {
      const turn = behavior.turnFrames;
      // Out: from full speed on its first frame, slowing evenly to a stop at the turn.
      if (age <= turn) {
        const share = 1 - age / turn;
        return { x: launchVelocity.x * share, y: launchVelocity.y * share };
      }
      // Back: at its start speed, straight at where its owner's body is now.
      if (!owner || owner.action === 'eliminated') return { x: 0, y: 0 };
      const { height } = characterOf(owner.characterId).stats;
      const dx = owner.position.x - object.position.x;
      const dy = owner.position.y + height / 2 - object.position.y;
      const distance = Math.hypot(dx, dy);
      const speed = Math.hypot(launchVelocity.x, launchVelocity.y);
      if (distance <= speed) return { x: dx, y: dy };
      return { x: (dx / distance) * speed, y: (dy / distance) * speed };
    }
  }
};

/** Whether an arcing object came down onto a platform's top this frame. */
const landed = (before: Vec2, object: SpawnedObject, platforms: readonly PlatformDef[]): boolean =>
  object.behavior.kind === 'arc' &&
  platforms.some(({ bounds }) => {
    const { x, y } = object.position;
    const wasAbove = before.y - object.radius >= bounds.top - 1e-9;
    const reached = y - object.radius <= bounds.top;
    return wasAbove && reached && x >= bounds.left && x <= bounds.right;
  });

/**
 * Objects one frame on: aged and moved by their behaviour, without those whose time is up, that
 * left the blast zone, landed (an arc) or came back to their owner (a returning one, also gone
 * once its owner is out of the match).
 */
export const moveObjects = (
  objects: readonly SpawnedObject[],
  fighters: readonly FighterState[],
  stage: StageDef,
): SpawnedObject[] =>
  objects.flatMap((object) => {
    const age = object.age + 1;
    const owner = fighters[object.owner];
    const velocity = nextVelocity(object, age, owner);
    const moved: SpawnedObject = {
      ...object,
      age,
      velocity,
      position: { x: object.position.x + velocity.x, y: object.position.y + velocity.y },
    };
    // A returning object is caught by its owner, and has no one to return to once they are out.
    const ownerOut = owner === undefined || owner.action === 'eliminated';
    const caught =
      returning(moved) && (ownerOut || touchesBody(moved.position, moved.radius, owner));
    const gone =
      age >= object.lifetime ||
      !insideZone(moved, stage.blastZone) ||
      landed(object.position, moved, stage.platforms) ||
      caught;
    return gone ? [] : [moved];
  });

/** The way a hit by the object launches: the way it flies, or its owner's facing if not sideways. */
const launchDirection = (object: SpawnedObject): 1 | -1 => {
  if (Math.abs(object.velocity.x) < 1e-9) return object.facing;
  return object.velocity.x > 0 ? 1 : -1;
};

/** A trap hits only once armed (#46); everything else from the start. */
const armed = (object: SpawnedObject): boolean =>
  object.behavior.kind !== 'trap' || object.age >= object.behavior.armFrames;

/**
 * Lets each object hit the first fighter it touches (in slot order) that is not its owner and
 * can be hit. A hit launches the target the way the object flies (or its owner faced),
 * freezes only the target, credits the owner, and uses the object up.
 */
export const resolveObjectHits = (
  objects: readonly SpawnedObject[],
  fighters: readonly FighterState[],
): { objects: SpawnedObject[]; fighters: FighterState[]; events: GameEvent[] } => {
  const next = [...fighters];
  const events: GameEvent[] = [];
  const left = objects.filter((object) => {
    if (!armed(object)) return true;
    const target = next.find(
      (fighter) =>
        fighter.slot !== object.owner &&
        fighter.action !== 'eliminated' &&
        fighter.invulnerableFrames === 0 &&
        touchesBody(object.position, object.radius, fighter),
    );
    if (!target) return true;
    const { target: struck, launch } = applyHit(
      target,
      object.hit,
      launchDirection(object),
      object.owner,
    );
    next[target.slot] = struck;
    const owner = next[object.owner];
    if (owner) {
      next[object.owner] = { ...owner, damageDealt: owner.damageDealt + object.hit.damage };
    }
    events.push({
      type: 'hit',
      attacker: object.owner,
      target: target.slot,
      damage: object.hit.damage,
      position: object.position,
      launch,
    });
    return false;
  });
  return { objects: left, fighters: next, events };
};
