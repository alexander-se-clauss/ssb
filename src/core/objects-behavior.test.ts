import { describe, expect, it } from 'vitest';
import { validateMove, type MoveDef, type ObjectBehavior, type SpawnDef } from './moves';
import { POSES } from './pose-data';
import { fighter, newMatch, run, settled, withFighter } from './test-helpers';
import type { MatchState, SpawnedObject } from './types';

const HIT = { damage: 5, angle: 40, baseKnockback: 7, knockbackGrowth: 111 };

/**
 * Two capsules on Battlefield, P1 at `x` facing right, P2 far away at the left edge unless
 * placed; plus `object` flying for P1.
 */
const withObject = (
  object: Partial<SpawnedObject>,
  { x = -3, targetX = -6.5, players = 2 }: { x?: number; targetX?: number; players?: number } = {},
): MatchState => {
  let state = withFighter(settled(newMatch(players)), 0, {
    position: { x, y: 0 },
    facing: 1,
    grounded: true,
  });
  state = withFighter(state, 1, { position: { x: targetX, y: 0 }, facing: 1, grounded: true });
  const velocity = object.velocity ?? { x: 0.25, y: 0 };
  const full: SpawnedObject = {
    id: 0,
    owner: 0,
    moveId: 'pulseShot',
    position: { x: x + 0.8, y: 1 },
    velocity,
    launchVelocity: velocity,
    facing: 1,
    age: 0,
    lifetime: 120,
    radius: 0.25,
    hit: HIT,
    behavior: { kind: 'straight' },
    ...object,
  };
  return { ...state, objects: [full], nextObjectId: 1 };
};

const only = (state: MatchState): SpawnedObject => {
  expect(state.objects).toHaveLength(1);
  const object = state.objects[0];
  if (!object) throw new Error('no object');
  return object;
};

/** The object's position on each of the next `frames` frames, while it is there. */
const path = (state: MatchState, frames: number) => {
  const points: { x: number; y: number }[] = [];
  let next = state;
  for (let i = 0; i < frames; i += 1) {
    next = run(next, 1);
    const object = next.objects[0];
    if (!object) break;
    points.push(object.position);
  }
  return points;
};

describe('projectile behaviours (#46)', () => {
  it('straight: flies on at its speed', () => {
    const start = withObject({ velocity: { x: 0.25, y: 0.05 } });
    const points = path(start, 10);
    points.forEach((point, index) => {
      expect(point.x).toBeCloseTo(-2.2 + 0.25 * (index + 1));
      expect(point.y).toBeCloseTo(1 + 0.05 * (index + 1));
    });
  });

  it('arc: falls under its own gravity in a parabola', () => {
    const gravity = 0.02;
    const start = withObject({
      position: { x: -2.2, y: 3 },
      velocity: { x: 0.2, y: 0.3 },
      behavior: { kind: 'arc', gravity },
    });
    const points = path(start, 20);
    expect(points).toHaveLength(20);
    points.forEach((point, index) => {
      const n = index + 1;
      expect(point.x).toBeCloseTo(-2.2 + 0.2 * n);
      // Gravity takes effect before each move, as for fighters.
      expect(point.y).toBeCloseTo(3 + 0.3 * n - (gravity * n * (n + 1)) / 2);
    });
    const peak = points.reduce((high, point) => (point.y > high.y ? point : high));
    expect(peak.y).toBeGreaterThan(5);
  });

  it('arc: is gone once it lands on a platform', () => {
    const start = withObject({
      position: { x: -1, y: 1 },
      velocity: { x: 0.05, y: 0 },
      behavior: { kind: 'arc', gravity: 0.02 },
    });
    const points = path(start, 60);
    // It falls from 1 onto the main stage (top 0) and stops existing there.
    expect(points.length).toBeLessThan(15);
    const last = points.at(-1);
    expect(last && last.y).toBeGreaterThan(0);
  });

  it('arc: falls past a platform it misses', () => {
    // Off the main stage's right edge (7), it keeps falling below the stage top.
    const start = withObject({
      position: { x: 7.5, y: 1 },
      velocity: { x: 0.02, y: 0 },
      behavior: { kind: 'arc', gravity: 0.02 },
    });
    const points = path(start, 30);
    expect(points).toHaveLength(30);
    expect(points.at(-1)?.y).toBeLessThan(-2);
  });

  it('arc: rises up through a platform and lands on it on the way down', () => {
    // From under the right soft platform (x 2..5, top 2.2), thrown up through it.
    const start = withObject({
      position: { x: 3.5, y: 1 },
      velocity: { x: 0, y: 0.35 },
      behavior: { kind: 'arc', gravity: 0.02 },
    });
    const points = path(start, 60);
    const highest = Math.max(...points.map((point) => point.y));
    expect(highest).toBeGreaterThan(2.2 + 1);
    expect(points.length).toBeLessThan(60);
    expect(points.at(-1)?.y).toBeGreaterThan(2.2);
  });

  it('straight: flies through platforms', () => {
    const start = withObject({ position: { x: 3.5, y: 3 }, velocity: { x: 0, y: -0.2 } });
    const points = path(start, 20);
    expect(points).toHaveLength(20);
    expect(points.at(-1)?.y).toBeLessThan(0);
  });

  it('trap: stays where it was set, even if something gave it speed', () => {
    const start = withObject({
      velocity: { x: 0.25, y: 0.1 },
      behavior: { kind: 'trap', armFrames: 20 },
    });
    const points = path(start, 50);
    expect(points).toHaveLength(50);
    for (const point of points) expect(point).toEqual({ x: -2.2, y: 1 });
  });

  it('trap: harmless until armed, then hits who walks into it', () => {
    // P2 stands right on the trap from the start.
    const trap = withObject(
      { velocity: { x: 0, y: 0 }, behavior: { kind: 'trap', armFrames: 20 } },
      { targetX: -2.2 },
    );
    const early = run(trap, 19);
    expect(fighter(early, 1).damage).toBe(0);
    expect(early.objects).toHaveLength(1);
    const armed = run(early, 1);
    expect(fighter(armed, 1).damage).toBe(HIT.damage);
    expect(armed.objects).toEqual([]);
  });

  it('return: slows to a stop at its turn, then flies back to its owner and is caught', () => {
    const turnFrames = 30;
    const start = withObject({
      velocity: { x: 0.3, y: 0 },
      launchVelocity: { x: 0.3, y: 0 },
      behavior: { kind: 'return', turnFrames },
    });
    const points = path(start, 120);
    const xs = points.map((point) => point.x);
    const far = Math.max(...xs);
    // Out with falling speed: about half of 0.3 * 30 frames.
    expect(far).toBeGreaterThan(-2.2 + 4);
    expect(far).toBeLessThan(-2.2 + 5);
    expect(xs.indexOf(far)).toBeGreaterThanOrEqual(turnFrames - 2);
    expect(xs.indexOf(far)).toBeLessThanOrEqual(turnFrames);
    // Back to the owner and caught well before its lifetime.
    expect(points.length).toBeLessThan(90);
    const caught = run(start, points.length + 1);
    expect(caught.objects).toEqual([]);
    expect(fighter(caught, 0).damage).toBe(0);
  });

  it('return: homes in on its owner even after the owner moved', () => {
    const start = withObject({
      velocity: { x: 0.3, y: 0 },
      launchVelocity: { x: 0.3, y: 0 },
      behavior: { kind: 'return', turnFrames: 30 },
    });
    // While it is out, the owner hops onto the right platform.
    const moved = withFighter(run(start, 30), 0, {
      position: { x: 3.5, y: 2.2 },
      grounded: true,
    });
    const back = only(run(moved, 2));
    expect(back.velocity.y).toBeGreaterThan(0);
    expect(Math.hypot(back.velocity.x, back.velocity.y)).toBeCloseTo(0.3);
  });

  it('return: is gone once its owner is out of the match', () => {
    // Three players, so the match goes on without the owner.
    const start = withObject(
      {
        velocity: { x: 0.3, y: 0 },
        launchVelocity: { x: 0.3, y: 0 },
        behavior: { kind: 'return', turnFrames: 30 },
      },
      { players: 3 },
    );
    const out = withFighter(run(start, 10), 0, { action: 'eliminated' });
    expect(run(out, 19).objects).toHaveLength(1);
    expect(run(out, 21).objects).toEqual([]);
  });

  it('return: hits a fighter on the way back, launching it the way it flies', () => {
    // P2 stands between the owner and the far point of the boomerang.
    const start = withObject(
      {
        velocity: { x: 0.3, y: 0 },
        launchVelocity: { x: 0.3, y: 0 },
        position: { x: 3, y: 1 },
        behavior: { kind: 'return', turnFrames: 30 },
      },
      { x: -5, targetX: 0 },
    );
    let state = start;
    while (state.objects.length > 0 && state.frame < start.frame + 200) state = run(state, 1);
    const target = fighter(state, 1);
    expect(target.damage).toBe(HIT.damage);
    expect(target.velocity.x).toBeLessThan(0);
  });

  it('keeps every behaviour plain data', () => {
    const behaviors: ObjectBehavior[] = [
      { kind: 'straight' },
      { kind: 'arc', gravity: 0.02 },
      { kind: 'trap', armFrames: 10 },
      { kind: 'return', turnFrames: 20 },
    ];
    for (const behavior of behaviors) {
      const state = run(withObject({ behavior }), 3);
      expect(JSON.parse(JSON.stringify(state.objects))).toEqual(state.objects);
    }
  });
});

describe('behaviour data (#46)', () => {
  const spawn: SpawnDef = {
    frame: 5,
    offset: { x: 0.8, y: 1 },
    velocity: { x: 0.25, y: 0 },
    lifetime: 60,
    radius: 0.3,
    hit: HIT,
  };
  const move = (behavior: ObjectBehavior): MoveDef => ({
    kind: 'attack',
    id: 'thrower',
    totalFrames: 20,
    hitboxes: [],
    poses: [{ frame: 0, pose: POSES.idle }],
    cancels: [],
    // A trap has no speed of its own.
    spawns: [{ ...spawn, behavior, ...(behavior.kind === 'trap' && { velocity: { x: 0, y: 0 } }) }],
  });

  it('accepts sound behaviours', () => {
    expect(() => validateMove(move({ kind: 'arc', gravity: 0.02 }))).not.toThrow();
    expect(() => validateMove(move({ kind: 'trap', armFrames: 0 }))).not.toThrow();
    expect(() => validateMove(move({ kind: 'return', turnFrames: 20 }))).not.toThrow();
  });

  it.each<[string, ObjectBehavior]>([
    ['an arc without gravity', { kind: 'arc', gravity: 0 }],
    ['a trap armed after its lifetime', { kind: 'trap', armFrames: 60 }],
    ['a trap armed between frames', { kind: 'trap', armFrames: 1.5 }],
    ['a boomerang that never turns', { kind: 'return', turnFrames: 0 }],
    ['a boomerang turning after its lifetime', { kind: 'return', turnFrames: 60 }],
  ])('refuses %s', (_, behavior) => {
    expect(() => validateMove(move(behavior))).toThrow(/spawn 0/);
  });

  it('refuses a trap that moves', () => {
    const trap = move({ kind: 'trap', armFrames: 10 });
    const moving = { ...trap, spawns: [{ ...spawn, behavior: { kind: 'trap', armFrames: 10 } }] };
    expect(() => validateMove(moving as MoveDef)).toThrow(/trap and cannot move/);
  });
});
