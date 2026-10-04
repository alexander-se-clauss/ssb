import { describe, expect, it, vi } from 'vitest';
import { knockback } from './combat';
import { validateMove, type MoveDef, type SpawnDef } from './moves';
import { POSES } from './pose-data';
import { CAPSULE } from './registry';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type * as MoveData from './move-data';
import type * as Registry from './registry';
import type { CharacterDef, MatchState, SpawnedObject } from './types';

/**
 * A test shot (#45): on frame 10 of a 30 frame move, a ball flies from in front of the chest the
 * way the fighter faces.
 */
const SHOT: SpawnDef = vi.hoisted(() => ({
  frame: 10,
  offset: { x: 0.8, y: 1 },
  velocity: { x: 0.3, y: 0 },
  lifetime: 40,
  radius: 0.3,
  hit: { damage: 6, angle: 30, baseKnockback: 0.15, knockbackGrowth: 0.003 },
}));

vi.mock('./move-data', async (importOriginal) => {
  const real = await importOriginal<typeof MoveData>();
  const { POSES } = await import('./pose-data');
  const shot: MoveDef = {
    kind: 'attack',
    id: 'testShot',
    totalFrames: 30,
    hitboxes: [],
    poses: [{ frame: 0, pose: POSES.idle }],
    cancels: [],
    spawns: [SHOT],
  };
  const moves = { ...real.MOVES, [shot.id]: shot };
  return {
    ...real,
    MOVES: moves,
    findMove: (id: string) => {
      const move = Object.hasOwn(moves, id) ? moves[id] : undefined;
      if (!move) throw new Error(`Unknown move "${id}"`);
      return move;
    },
  };
});

vi.mock('./registry', async (importOriginal) => {
  const real = await importOriginal<typeof Registry>();
  const shooter: CharacterDef = {
    ...real.CAPSULE,
    id: 'shooter',
    name: 'Shooter',
    moves: { ...real.CAPSULE.moves, neutralSpecial: 'testShot' },
  };
  const all = [...real.CHARACTERS, shooter];
  return { ...real, CHARACTERS: all, findCharacter: (id: string) => all.find((c) => c.id === id) };
});

const SPECIAL = [inputOf({ special: true })];

/** The shooter as P1 at `x` facing `facing`, and a capsule as P2 at `targetX`, on the stage. */
const faceOff = (x = -3, facing: 1 | -1 = 1, targetX = 3): MatchState => {
  let state = run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: 'shooter' }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );
  state = withFighter(state, 0, { position: { x, y: 0 }, facing, grounded: true });
  state = withFighter(state, 1, { position: { x: targetX, y: 0 }, facing: -1, grounded: true });
  return run(state, 1);
};

/** Presses special, then lets go, and runs until frame `moveFrame` of the shot. */
const shootUntil = (state: MatchState, moveFrame: number): MatchState =>
  run(run(state, 1, SPECIAL), moveFrame);

const only = (state: MatchState): SpawnedObject => {
  expect(state.objects).toHaveLength(1);
  const object = state.objects[0];
  if (!object) throw new Error('no object');
  return object;
};

describe('spawned objects (#45)', () => {
  it('starts a match with none', () => {
    const state = faceOff();
    expect(state.objects).toEqual([]);
  });

  it('spawns on the frame the move lists, in front of the fighter the way it faces', () => {
    const before = shootUntil(faceOff(), SHOT.frame - 1);
    expect(fighter(before, 0).moveId).toBe('testShot');
    expect(before.objects).toEqual([]);

    const spawned = run(before, 1);
    expect(fighter(spawned, 0).actionFrame).toBe(SHOT.frame);
    const shot = only(spawned);
    const shooter = fighter(spawned, 0);
    expect(shot.owner).toBe(0);
    expect(shot.position.x).toBeCloseTo(shooter.position.x + SHOT.offset.x);
    expect(shot.position.y).toBeCloseTo(shooter.position.y + SHOT.offset.y);
    expect(shot.velocity).toEqual({ x: SHOT.velocity.x, y: 0 });
    expect(shot.age).toBe(0);
    // Its hit is plain data in the state, not a reference to the move.
    expect(JSON.parse(JSON.stringify(shot))).toEqual(shot);
  });

  it('mirrors offset and speed for a fighter facing left', () => {
    const state = shootUntil(faceOff(3, -1, -3), SHOT.frame);
    const shot = only(state);
    expect(shot.position.x).toBeCloseTo(fighter(state, 0).position.x - SHOT.offset.x);
    expect(shot.velocity.x).toBeCloseTo(-SHOT.velocity.x);
  });

  it('spawns once per move, and gives each object its own id', () => {
    // Facing left from the right of the stage, with the target behind: nothing is hit.
    const first = shootUntil(faceOff(6, -1, 6.5), SHOT.frame + 5);
    expect(first.objects).toHaveLength(1);
    // The move is over by frame 30; a second shot gets the next id.
    const again = shootUntil(run(first, 20), SHOT.frame);
    const firstId = only(first).id;
    expect(again.objects.at(-1)?.id).toBe(firstId + 1);
    expect(again.nextObjectId).toBe(firstId + 2);
  });

  it('moves by its velocity every frame, the same way every run', () => {
    const spawned = only(shootUntil(faceOff(-3, 1, -6.5), SHOT.frame));
    const later = only(run(shootUntil(faceOff(-3, 1, -6.5), SHOT.frame), 5));
    expect(later.age).toBe(5);
    expect(later.position.x).toBeCloseTo(spawned.position.x + 5 * SHOT.velocity.x);
    expect(later.position.y).toBeCloseTo(spawned.position.y);
    const replay = run(shootUntil(faceOff(-3, 1, -6.5), SHOT.frame), 5);
    expect(replay.objects).toEqual([later]);
  });

  it('hits a fighter in its path, launching it for the owner, and is gone', () => {
    let state = shootUntil(faceOff(-3, 1, 0), SHOT.frame);
    let frames = 0;
    while (state.objects.length > 0 && frames < 40) {
      state = run(state, 1);
      frames += 1;
    }
    const target = fighter(state, 1);
    expect(state.objects).toEqual([]);
    expect(target.damage).toBe(SHOT.hit.damage);
    expect(target.action).toBe('hitstun');
    expect(target.lastHitBy).toBe(0);
    expect(fighter(state, 0).damageDealt).toBe(SHOT.hit.damage);
    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: 'hit',
        attacker: 0,
        target: 1,
        damage: SHOT.hit.damage,
      }),
    );
    // Launched the way the shot flew, as hard as a hitbox with the same numbers.
    const speed = knockback(SHOT.hit, SHOT.hit.damage, CAPSULE.stats.weight);
    const radians = (SHOT.hit.angle * Math.PI) / 180;
    expect(target.velocity.x).toBeCloseTo(Math.cos(radians) * speed);
    expect(target.velocity.y).toBeCloseTo(Math.sin(radians) * speed);
    // Only the target freezes; the shooter was never in contact.
    expect(target.hitlagFrames).toBeGreaterThan(0);
    expect(fighter(state, 0).hitlagFrames).toBe(0);
  });

  it('launches away from where it came from for a shot flying left', () => {
    let state = shootUntil(faceOff(3, -1, 0), SHOT.frame);
    while (state.objects.length > 0 && state.frame < 400) state = run(state, 1);
    expect(fighter(state, 1).velocity.x).toBeLessThan(0);
  });

  it('never hits its owner', () => {
    const state = shootUntil(faceOff(-3, 1, -6.5), SHOT.frame);
    const shot = only(state);
    // Put the shot right on the shooter's chest, flying through it.
    const onOwner = {
      ...state,
      objects: [{ ...shot, position: { x: fighter(state, 0).position.x, y: 0.9 } }],
    };
    const after = run(onOwner, 3);
    expect(fighter(after, 0).damage).toBe(0);
    expect(after.objects).toHaveLength(1);
  });

  it('flies through an invulnerable fighter', () => {
    let state = shootUntil(faceOff(-3, 1, 0), SHOT.frame);
    state = withFighter(state, 1, { invulnerableFrames: 100 });
    state = run(state, 25);
    expect(fighter(state, 1).damage).toBe(0);
    expect(only(state).position.x).toBeGreaterThan(fighter(state, 1).position.x);
  });

  it('despawns when its lifetime ends', () => {
    const state = shootUntil(faceOff(-3, 1, -6.5), SHOT.frame);
    expect(only(run(state, SHOT.lifetime - 1)).age).toBe(SHOT.lifetime - 1);
    expect(run(state, SHOT.lifetime).objects).toEqual([]);
  });

  it('despawns once it leaves the blast zone', () => {
    const state = shootUntil(faceOff(-3, 1, -6.5), SHOT.frame);
    const shot = only(state);
    const nearEdge = {
      ...state,
      objects: [{ ...shot, position: { x: BATTLEFIELD.blastZone.right - 0.1, y: 1 } }],
    };
    expect(run(nearEdge, 1).objects).toEqual([]);
  });

  it('never appears when it would spawn outside the blast zone', () => {
    // The shooter just inside the right edge, facing out: the shot would start past it.
    let state = faceOff(-3, 1, -6.5);
    const edge = BATTLEFIELD.blastZone.right - SHOT.offset.x / 2;
    state = withFighter(state, 0, { position: { x: edge, y: 0 }, grounded: false });
    state = shootUntil(state, SHOT.frame);
    expect(fighter(state, 0).moveId).toBe('testShot');
    expect(state.objects).toEqual([]);
  });

  it('keeps flying when its owner is KO-ed', () => {
    let state = shootUntil(faceOff(-3, 1, -6.5), SHOT.frame);
    state = withFighter(state, 0, { position: { x: -30, y: 0 }, grounded: false });
    state = run(state, 1);
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: 'ko', slot: 0, stocksLeft: 2 }),
    );
    expect(only(state).owner).toBe(0);
  });
});

describe('spawn data (#45)', () => {
  const base: MoveDef = {
    kind: 'attack',
    id: 'spawner',
    totalFrames: 30,
    hitboxes: [],
    poses: [{ frame: 0, pose: POSES.idle }],
    cancels: [],
  };
  const withSpawn = (patch: Partial<SpawnDef>): MoveDef => ({
    ...base,
    spawns: [{ ...SHOT, ...patch }],
  });

  it('accepts a sound spawn', () => {
    expect(() => validateMove(withSpawn({}))).not.toThrow();
  });

  it.each([
    ['on the start frame', { frame: 0 }],
    ['after the move', { frame: 30 }],
    ['between frames', { frame: 2.5 }],
    ['with no lifetime', { lifetime: 0 }],
    ['with no size', { radius: 0 }],
    ['with a broken speed', { velocity: { x: Number.NaN, y: 0 } }],
    ['with a broken knockback', { hit: { ...SHOT.hit, knockbackGrowth: Number.NaN } }],
  ])('refuses a spawn %s', (_, patch) => {
    expect(() => validateMove(withSpawn(patch))).toThrow(/spawn 0/);
  });
});
