import { describe, expect, it, vi } from 'vitest';
import { FIGHTER } from './config';
import { validateMove, type MoveDef } from './moves';
import { POSES } from './pose-data';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type * as MoveData from './move-data';
import type * as Registry from './registry';
import type { CharacterDef, MatchState } from './types';

/** Test moves that set the fighter's speed (#39): a lunge forward, and a lift off the ground. */
vi.mock('./move-data', async (importOriginal) => {
  const real = await importOriginal<typeof MoveData>();
  const { POSES } = await import('./pose-data');
  const base = {
    kind: 'attack',
    hitboxes: [],
    poses: [{ frame: 0, pose: POSES.jab }],
    cancels: [],
  };
  const added: MoveDef[] = [
    { ...base, kind: 'attack', id: 'testLunge', totalFrames: 20, motion: [{ frame: 5, x: 0.2 }] },
    { ...base, kind: 'attack', id: 'testLift', totalFrames: 20, motion: [{ frame: 3, y: 0.3 }] },
    { ...base, kind: 'attack', id: 'testDive', totalFrames: 20, motion: [{ frame: 3, y: -0.3 }] },
  ];
  const moves = { ...real.MOVES, ...Object.fromEntries(added.map((m) => [m.id, m])) };
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
  const mover: CharacterDef = {
    ...real.CAPSULE,
    id: 'mover',
    name: 'Mover',
    moves: {
      ...real.CAPSULE.moves,
      neutralSpecial: 'testLunge',
      upSpecial: 'testLift',
      downSpecial: 'testDive',
    },
  };
  const all = [...real.CHARACTERS, mover];
  return { ...real, CHARACTERS: all, findCharacter: (id: string) => all.find((c) => c.id === id) };
});

/** The mover alone on Battlefield's main stage, settled, facing `facing`. */
const standing = (facing: 1 | -1): MatchState => {
  const state = run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: 'mover' }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );
  return run(withFighter(state, 0, { position: { x: 0, y: 0 }, facing, grounded: true }), 1);
};

const NEUTRAL_SPECIAL = [inputOf({ special: true })];
const UP_SPECIAL = [inputOf({ y: 1, special: true })];

describe('moves that set the fighter speed (#39)', () => {
  it('sets the speed on its frame, forward the way the fighter faces', () => {
    for (const facing of [1, -1] as const) {
      const started = run(standing(facing), 1, NEUTRAL_SPECIAL);
      expect(fighter(started, 0).moveId).toBe('testLunge');
      const before = fighter(run(started, 4), 0);
      expect(before.velocity.x).toBe(0);
      const lunged = fighter(run(started, 5), 0);
      // Set on frame 5, then slowed by the ground's friction like any slide.
      expect(lunged.velocity.x).toBeCloseTo(facing * (0.2 - FIGHTER.groundFriction), 6);
      expect(fighter(run(started, 15), 0).position.x * facing).toBeGreaterThan(0.5);
    }
  });

  it('keeps the part of the speed it leaves out', () => {
    const falling = withFighter(standing(1), 0, {
      position: { x: 0, y: 6 },
      velocity: { x: 0, y: -0.1 },
      grounded: false,
      action: 'airborne',
    });
    const started = run(falling, 1, NEUTRAL_SPECIAL);
    const before = fighter(run(started, 4), 0).velocity.y;
    expect(fighter(run(started, 5), 0).velocity.y).toBeCloseTo(before - FIGHTER.gravity, 6);
  });

  it('takes a grounded fighter into the air with an upward speed', () => {
    const started = run(standing(1), 1, UP_SPECIAL);
    expect(fighter(started, 0).moveId).toBe('testLift');
    expect(fighter(run(started, 2), 0).grounded).toBe(true);
    const lifted = fighter(run(started, 3), 0);
    expect(lifted.grounded).toBe(false);
    expect(lifted.velocity.y).toBeCloseTo(0.3 - FIGHTER.gravity, 6);
    expect(lifted.position.y).toBeGreaterThan(0);
    // Off the ground, the ground jump is gone and the air jumps stay.
    expect(lifted.jumpsRemaining).toBe(FIGHTER.airJumps);
    // Without the helpless flag the fighter is free in the air once the move ends.
    const done = fighter(run(started, 20), 0);
    expect(done.action).toBe('airborne');
    expect(done.position.y).toBeGreaterThan(2);
  });

  it('leaves a grounded fighter on the ground with a downward speed', () => {
    const started = run(standing(1), 1, [inputOf({ y: -1, special: true })]);
    expect(fighter(started, 0).moveId).toBe('testDive');
    const after = fighter(run(started, 5), 0);
    expect(after.grounded).toBe(true);
    expect(after.position.y).toBe(0);
  });

  it('sets no speed once a hit has ended the move', () => {
    const started = run(standing(1), 1, NEUTRAL_SPECIAL);
    // Knocked into hitstun on frame 2, before the lunge on frame 5.
    const hit = withFighter(run(started, 2), 0, {
      action: 'hitstun',
      moveId: null,
      hitstunFrames: 10,
      velocity: { x: 0, y: 0 },
    });
    for (let i = 1; i <= 8; i += 1) {
      expect(Math.abs(fighter(run(hit, i), 0).velocity.x)).toBeLessThan(0.01);
    }
  });

  it('waits out hitlag, then sets the speed once on its frame', () => {
    const started = run(standing(1), 1, NEUTRAL_SPECIAL);
    const frozen = withFighter(run(started, 4), 0, { hitlagFrames: 6 });
    expect(fighter(run(frozen, 6), 0).velocity.x).toBe(0);
    const lunged = fighter(run(frozen, 7), 0);
    expect(lunged.velocity.x).toBeCloseTo(0.2 - FIGHTER.groundFriction, 6);
    // Friction slows it from then on; it is not set again.
    expect(fighter(run(frozen, 8), 0).velocity.x).toBeLessThan(lunged.velocity.x);
  });

  it('refuses motion outside the move', () => {
    const move = (frame: number, extra: object = {}): MoveDef => ({
      kind: 'attack',
      id: 'broken',
      totalFrames: 10,
      hitboxes: [],
      poses: [{ frame: 0, pose: POSES.jab }],
      cancels: [],
      motion: [{ frame, x: 0.1, ...extra }],
    });
    // Frame 0 is the frame the move starts on; the runner first plays frame 1.
    expect(() => validateMove(move(0))).toThrow(/motion 0/);
    expect(() => validateMove(move(10))).toThrow(/motion 0/);
    expect(() => validateMove(move(2.5))).toThrow(/motion 0/);
    expect(() => validateMove(move(3, { y: Number.NaN }))).toThrow(/motion 0/);
    expect(() => validateMove(move(3))).not.toThrow();
    const twice: MoveDef = {
      ...move(3),
      motion: [
        { frame: 4, x: 0.1 },
        { frame: 4, y: 0.1 },
      ],
    };
    expect(() => validateMove(twice)).toThrow(/motion 1 is out of order/);
  });
});
