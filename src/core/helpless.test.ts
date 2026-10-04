import { describe, expect, it, vi } from 'vitest';
import { HELPLESS, LEDGE } from './config';
import { hangPosition } from './ledge';
import { CAPSULE } from './registry';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type * as MoveData from './move-data';
import type * as Registry from './registry';
import type { MoveDef } from './moves';
import type { CharacterDef, LedgeDef, MatchState } from './types';

/**
 * A recovery move for the tests: 20 frames, no hitbox, leaves the fighter helpless (#44); it drifts
 * like an aerial and has its own landing lag.
 */
const RECOVERY_FRAMES = 20;

vi.mock('./move-data', async (importOriginal) => {
  const real = await importOriginal<typeof MoveData>();
  const { POSES } = await import('./pose-data');
  const recovery: MoveDef = {
    kind: 'attack',
    id: 'testRecovery',
    totalFrames: 20,
    hitboxes: [],
    poses: [{ frame: 0, pose: POSES.jump }],
    cancels: [],
    helpless: true,
    landingLag: 12,
  };
  const moves = { ...real.MOVES, [recovery.id]: recovery };
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
  const recoverer: CharacterDef = {
    ...real.CAPSULE,
    id: 'recoverer',
    name: 'Recoverer',
    moves: { ...real.CAPSULE.moves, upSpecial: 'testRecovery' },
  };
  const all = [...real.CHARACTERS, recoverer];
  return { ...real, CHARACTERS: all, findCharacter: (id: string) => all.find((c) => c.id === id) };
});

const UP_SPECIAL = [inputOf({ y: 1, special: true })];

/** The recoverer as P1 on Battlefield, settled; with `opponent`, a capsule as P2. */
const match = (opponent = false): MatchState =>
  run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: 'recoverer' }, ...(opponent ? [{ characterId: CAPSULE.id }] : [])],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );

/** The recoverer rising high in the air beside Battlefield, its up special just started. */
const recovering = (x = 10, y = 6, state = match()): MatchState => {
  const rising = withFighter(state, 0, {
    position: { x, y },
    velocity: { x: 0, y: 0.2 },
    grounded: false,
    action: 'airborne',
    jumpsRemaining: CAPSULE.stats.airJumps,
    airDodgeUsed: false,
  });
  const started = run(rising, 1, UP_SPECIAL);
  expect(fighter(started, 0).moveId).toBe('testRecovery');
  return started;
};

/** The same, with the up special played out. */
const helpless = (x = 10, y = 6, state = match()): MatchState =>
  run(recovering(x, y, state), RECOVERY_FRAMES);

describe('helpless after a recovery move (#44)', () => {
  it('follows a move flagged helpless that ends in the air', () => {
    expect(fighter(helpless(), 0).action).toBe('helpless');
  });

  it('does not follow a move without the flag', () => {
    const state = withFighter(helpless(), 0, { action: 'airborne', moveId: null });
    const started = run(state, 1, [inputOf({ attack: true })]);
    expect(fighter(started, 0).moveId).toBe(CAPSULE.moves.neutralAir);
    expect(fighter(run(started, 40), 0).action).toBe('airborne');
  });

  it('blocks jumps, attacks, specials and the air dodge', () => {
    const state = helpless();
    const before = fighter(state, 0);
    for (const press of [
      { jump: true },
      { attack: true },
      { special: true },
      { y: 1, special: true },
      { shield: true },
    ]) {
      const after = fighter(run(run(state, 1, [inputOf(press)]), 5), 0);
      expect(after.action, JSON.stringify(press)).toBe('helpless');
      expect(after.moveId).toBeNull();
      expect(after.jumpsRemaining).toBe(before.jumpsRemaining);
      expect(after.velocity.y).toBeLessThan(before.velocity.y);
    }
    // Pressed late in the recovery move, waiting in the buffer, a press does not come out either.
    const late = run(run(recovering(), RECOVERY_FRAMES - 2), 1, [inputOf({ attack: true })]);
    const afterLate = fighter(run(late, 8), 0);
    expect(afterLate.action).toBe('helpless');
    expect(afterLate.moveId).toBeNull();
  });

  it('still drifts, though more slowly, and does not fast-fall', () => {
    // High enough to fall for a while without leaving the blast zone.
    const state = helpless(10, 14);
    const drifted = fighter(run(state, 30, [inputOf({ x: -1 })]), 0);
    expect(drifted.position.x).toBeLessThan(fighter(state, 0).position.x - 1);
    expect(Math.abs(drifted.velocity.x)).toBeCloseTo(CAPSULE.stats.airSpeed * HELPLESS.drift, 6);
    const down = fighter(run(state, 30, [inputOf({ y: -1 })]), 0);
    expect(down.velocity.y).toBeGreaterThanOrEqual(-CAPSULE.stats.maxFallSpeed);
  });

  it('ends on landing, with its landing lag', () => {
    // Above the main stage, so it falls onto it.
    let state = helpless(3, 4);
    expect(fighter(state, 0).action).toBe('helpless');
    let frames = 0;
    while (!fighter(state, 0).grounded && frames < 200) {
      state = run(state, 1);
      frames += 1;
    }
    expect(fighter(state, 0).action).toBe('landing');
    expect(fighter(state, 0).landingLagFrames).toBe(HELPLESS.landingLagFrames);
    const free = run(state, HELPLESS.landingLagFrames);
    expect(fighter(free, 0).action).toBe('idle');
  });

  it('ends on a ledge grab', () => {
    const ledge = BATTLEFIELD.ledges[1] as LedgeDef;
    const hang = hangPosition(ledge, CAPSULE);
    const state = withFighter(helpless(), 0, {
      position: { x: hang.x, y: hang.y + 0.1 },
      velocity: { x: 0, y: 0 },
    });
    expect(fighter(state, 0).action).toBe('helpless');
    const caught = fighter(run(state, 1), 0);
    expect(caught.action).toBe('ledge');
    // On the ledge the fighter has its options again.
    const jumped = run(run(state, LEDGE.waitFrames + 1), 1, [inputOf({ jump: true })]);
    expect(fighter(jumped, 0).velocity.y).toBeGreaterThan(0);
  });

  it('ends on a hit, which gives control back once hitstun is over', () => {
    const state = helpless(10, 6, match(true));
    const p1 = fighter(state, 0);
    // P2 drops past P1 with a neutral air, facing it.
    const attacker = withFighter(state, 1, {
      position: { x: p1.position.x + 0.6, y: p1.position.y + 1 },
      // Falling as fast as P1, so the neutral air keeps up with it.
      velocity: { x: 0, y: p1.velocity.y },
      grounded: false,
      action: 'airborne',
      facing: -1,
    });
    let next = run(attacker, 1, [inputOf({}), inputOf({ attack: true })]);
    let frames = 0;
    while (fighter(next, 0).action !== 'hitstun' && frames < 20) {
      next = run(next, 1);
      frames += 1;
    }
    expect(fighter(next, 0).action).toBe('hitstun');
    while (fighter(next, 0).action === 'hitstun' && frames < 200) {
      next = run(next, 1);
      frames += 1;
    }
    expect(fighter(next, 0).action).toBe('airborne');
    const jumped = run(next, 1, [inputOf({ jump: true })]);
    expect(fighter(jumped, 0).velocity.y).toBeGreaterThan(0);
  });

  it('catches a ledge on the way down while the move still runs (#39)', () => {
    const ledge = BATTLEFIELD.ledges[1] as LedgeDef;
    const hang = hangPosition(ledge, CAPSULE);
    const falling = withFighter(recovering(), 0, {
      position: { x: hang.x, y: hang.y + 0.1 },
      velocity: { x: 0, y: 0 },
    });
    expect(fighter(falling, 0).action).toBe('attack');
    const caught = fighter(run(falling, 1), 0);
    expect(caught.action).toBe('ledge');
    expect(caught.moveId).toBeNull();
    // Still rising, it does not: up specials snap to a ledge only once they fall.
    const rising = withFighter(recovering(), 0, {
      position: { x: hang.x, y: hang.y - 0.3 },
      velocity: { x: 0, y: 0.2 },
    });
    expect(fighter(run(rising, 1), 0).action).toBe('attack');
  });

  it('does not fast-fall during the recovery move, though it drifts like an aerial (#39)', () => {
    const falling = withFighter(recovering(), 0, { velocity: { x: 0, y: -0.05 } });
    const down = fighter(run(falling, 15, [inputOf({ y: -1 })]), 0);
    expect(down.action).toBe('attack');
    expect(down.velocity.y).toBeGreaterThanOrEqual(-CAPSULE.stats.maxFallSpeed);
    const drifted = fighter(run(falling, 15, [inputOf({ x: -1 })]), 0);
    expect(drifted.velocity.x).toBeLessThan(-0.05);
  });

  it('does not follow the recovery move used on the ground', () => {
    const state = run(match(), 1, UP_SPECIAL);
    expect(fighter(state, 0).moveId).toBe('testRecovery');
    const done = fighter(run(state, RECOVERY_FRAMES), 0);
    expect(done.action).toBe('idle');
    expect(done.grounded).toBe(true);
  });
});
