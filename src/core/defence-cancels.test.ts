import { describe, expect, it } from 'vitest';
import { DODGE } from './config';
import { findMove } from './move-data';
import { validateMove, type MoveDef } from './moves';
import { POSES } from './pose-data';
import { CAPSULE, RIVET, VELA } from './registry';
import { createMatch, step } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

const ATTACK = inputOf({ attack: true });
const DODGE_PRESS = inputOf({ shield: true });
const DOWN_SPECIAL = inputOf({ y: -1, special: true });
const NONE = inputOf({});

/** One fighter of `characterId` settled on Battlefield, alone. */
const solo = (characterId: string): MatchState =>
  run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );

/** Plays with no input until fighter 0 is on `frame` of `moveId`. */
const until = (state: MatchState, moveId: string, frame: number): MatchState => {
  let next = state;
  for (let i = 0; i < 200; i += 1) {
    const f = fighter(next, 0);
    if (f.moveId === moveId && f.actionFrame === frame) return next;
    next = step(next, [NONE]);
  }
  throw new Error(`Never reached frame ${frame} of ${moveId}`);
};

const press = (state: MatchState, input: PlayerInput): MatchState => step(state, [input]);

/** The first frame of the move's cancel window on `on`. */
const windowStart = (moveId: string, on: string): number => {
  const cancel = findMove(moveId).cancels.find((c) => c.on === on);
  if (!cancel) throw new Error(`${moveId} has no ${on} cancel`);
  return cancel.from;
};

describe('dodge, block and counter as cancel targets (#52)', () => {
  it("plays Vela's signature flow: jab, jab, dodge-cancel, counter", () => {
    let state = press(solo(VELA.id), ATTACK);
    state = press(until(state, 'jab', windowStart('jab', 'jab')), ATTACK);
    expect(fighter(state, 0).moveId).toBe('jab2');
    // The dodge cuts jab 2 short as soon as its window opens.
    state = press(until(state, 'jab2', windowStart('jab2', 'dodge')), DODGE_PRESS);
    expect(fighter(state, 0)).toMatchObject({ action: 'sidestepIn', moveId: null });
    // Counter pressed near the end of the sidestep waits, then comes out on the first free frame.
    const sidestepStart = fighter(state, 0).actionFrame;
    state = run(state, DODGE.sidestep.totalFrames - 4 - sidestepStart, [NONE]);
    state = press(state, DOWN_SPECIAL);
    expect(fighter(state, 0).action).toBe('sidestepIn');
    while (fighter(state, 0).action === 'sidestepIn') state = press(state, NONE);
    // The sidestep ends into a free frame, and the waiting counter starts on the next.
    expect(fighter(state, 0).buffer?.action).toBe('downSpecial');
    state = press(state, NONE);
    expect(fighter(state, 0)).toMatchObject({ moveId: 'riposte', actionFrame: 0 });
  });

  it('lets Vela cut her jabs straight into Riposte, her counter', () => {
    let state = press(solo(VELA.id), ATTACK);
    state = press(until(state, 'jab', windowStart('jab', 'downSpecial')), DOWN_SPECIAL);
    expect(fighter(state, 0)).toMatchObject({ moveId: 'riposte', actionFrame: 0 });
  });

  it('lets Rivet cut his jabs into Iron Guard, his block', () => {
    let state = press(solo(RIVET.id), ATTACK);
    state = press(until(state, 'jab', windowStart('jab', 'jab')), ATTACK);
    state = press(until(state, 'jab2', windowStart('jab2', 'downSpecial')), DOWN_SPECIAL);
    expect(fighter(state, 0)).toMatchObject({ moveId: 'ironGuard', actionFrame: 0 });
  });

  it('cuts even the jab finisher into a roll during its recovery', () => {
    let state = press(solo(CAPSULE.id), ATTACK);
    state = press(until(state, 'jab', windowStart('jab', 'jab')), ATTACK);
    state = press(until(state, 'jab2', windowStart('jab2', 'jab')), ATTACK);
    expect(fighter(state, 0).moveId).toBe('jab3');
    state = press(
      until(state, 'jab3', windowStart('jab3', 'dodge')),
      inputOf({ x: -1, shield: true }),
    );
    expect(fighter(state, 0).action).toBe('backRoll');
  });

  it('keeps a dodge pressed before the window and fires it when the window opens', () => {
    let state = press(solo(VELA.id), ATTACK);
    state = press(state, DODGE_PRESS);
    // The jab's hit comes out first.
    state = until(state, 'jab', windowStart('jab', 'dodge') - 1);
    expect(fighter(state, 0).moveId).toBe('jab');
    state = press(state, NONE);
    expect(fighter(state, 0).action).toBe('sidestepIn');
  });

  it('rolls forward out of a jab with the stick ahead', () => {
    let state = press(solo(CAPSULE.id), ATTACK);
    state = press(
      until(state, 'jab', windowStart('jab', 'dodge')),
      inputOf({ x: 1, shield: true }),
    );
    expect(fighter(state, 0).action).toBe('forwardRoll');
  });

  it('does nothing on down special for a fighter with no block or counter', () => {
    let state = press(solo(CAPSULE.id), ATTACK);
    state = press(until(state, 'jab', windowStart('jab', 'downSpecial')), DOWN_SPECIAL);
    expect(fighter(state, 0).moveId).toBe('jab');
  });

  it.each([
    ['a dodge cancel that names a move', { on: 'dodge', into: 'jab', from: 4, to: 10 }],
    ['a cancel on one kind of dodge', { on: 'roll', from: 4, to: 10 }],
    ['a cancel on a jump', { on: 'jump', from: 4, to: 10 }],
  ] as const)('refuses %s, which could never fire as meant', (_, cancel) => {
    const move: MoveDef = {
      kind: 'attack',
      id: 'feint',
      totalFrames: 20,
      hitboxes: [],
      poses: [{ frame: 0, pose: POSES.idle }],
      cancels: [cancel],
    };
    expect(() => validateMove(move)).toThrow(/cancel 0/);
  });
});
