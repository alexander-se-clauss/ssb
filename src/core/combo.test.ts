import { describe, expect, it } from 'vitest';
import { INPUT } from './config';
import { MOVES, findMove, validateMoves } from './move-data';
import { validateMove, type MoveDef } from './moves';
import { step } from './simulation';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { MatchState } from './types';

const ATTACK = inputOf({ attack: true });
const FORWARD_ATTACK = inputOf({ x: 0.5, attack: true });
const NONE = inputOf({});

/** Releases every button until fighter 0 reaches `actionFrame` of `moveId`. */
const until = (state: MatchState, moveId: string, actionFrame: number): MatchState => {
  let next = state;
  for (let i = 0; i < 200; i += 1) {
    const f = fighter(next, 0);
    if (f.moveId === moveId && f.actionFrame === actionFrame) return next;
    next = step(next, [NONE]);
  }
  throw new Error(`Fighter 0 never reached frame ${actionFrame} of ${moveId}`);
};

/** One step with `input` for fighter 0. */
const press = (state: MatchState, input = ATTACK): MatchState => step(state, [input]);

/** The first frame of each move's cancel window into the next jab. */
const windowOf = (id: string) => {
  const cancel = findMove(id).cancels.find((c) => c.on === 'jab');
  if (!cancel) throw new Error(`${id} has a cancel`);
  return cancel;
};

describe('jab combo', () => {
  it('chains jab 1, 2 and 3 when attack is pressed inside each window', () => {
    let state = press(settled());
    expect(fighter(state, 0).moveId).toBe('jab');
    state = press(until(state, 'jab', windowOf('jab').from));
    expect(fighter(state, 0)).toMatchObject({ moveId: 'jab2', actionFrame: 0 });
    state = press(until(state, 'jab2', windowOf('jab2').from));
    expect(fighter(state, 0)).toMatchObject({ moveId: 'jab3', actionFrame: 0 });
    // The kick ends the chain: no window, so it plays out.
    expect(findMove('jab3').cancels.some((c) => c.on === 'jab')).toBe(false);
  });

  it('keeps a buffered jab 2 when jump is pressed after it', () => {
    let state = press(settled());
    state = press(until(state, 'jab', 4));
    state = press(state, inputOf({ jump: true }));
    state = until(state, 'jab2', 0);
    expect(fighter(state, 0).moveId).toBe('jab2');
  });

  it('opens jab 2 exactly when the window opens if attack was pressed just before', () => {
    const { from } = windowOf('jab');
    // Pressed a few frames early, inside the buffer: jab 1 plays on until the window opens.
    expect(from - 3).toBeGreaterThan(0);
    let state = press(until(press(settled()), 'jab', from - 4));
    expect(fighter(state, 0)).toMatchObject({ moveId: 'jab', actionFrame: from - 3 });
    state = until(state, 'jab', from - 1);
    expect(fighter(step(state, [NONE]), 0)).toMatchObject({ moveId: 'jab2', actionFrame: 0 });
  });

  it('misses the window when attack comes after jab 1 is over: a new jab 1 starts', () => {
    let state = press(settled());
    state = run(state, findMove('jab').totalFrames + 2, [NONE]);
    expect(fighter(state, 0).action).toBe('idle');
    state = press(state);
    expect(fighter(state, 0).moveId).toBe('jab');
  });

  it('chains only on the slot the window names: a forward tilt does not continue the jab', () => {
    const state = press(until(press(settled()), 'jab', windowOf('jab').from), FORWARD_ATTACK);
    expect(fighter(state, 0).moveId).toBe('jab');
  });

  it('lands all three hits on a target in jab range, and jab 3 launches it', () => {
    let state = withFighter(settled(), 0, { position: { x: 0, y: 0 }, facing: 1 });
    state = withFighter(state, 1, { position: { x: 0.8, y: 0 }, facing: -1 });
    const hits: string[] = [];
    // Mashing attack, as a player would.
    for (let i = 0; i < 60; i += 1) {
      state = step(state, [i % 4 === 0 ? ATTACK : NONE]);
      for (const event of state.events) {
        if (event.type === 'hit') hits.push(fighter(state, 0).moveId ?? '');
      }
    }
    expect(hits).toEqual(['jab', 'jab2', 'jab3']);
    const damage = ['jab', 'jab2', 'jab3'].map((id) => findMove(id).hitboxes[0]?.damage ?? 0);
    expect(fighter(state, 1).damage).toBe(damage.reduce((sum, d) => sum + d, 0));
    // Jab 1 and 2 keep the target close; the kick sends it flying.
    expect(fighter(state, 1).position.y).toBeGreaterThan(1);
  });
});

describe('input buffer', () => {
  /** Fighter 0 in hitstun for `frames` more frames, then pressing attack once. */
  const stunnedThenPress = (frames: number) =>
    press(withFighter(settled(), 0, { action: 'hitstun', actionFrame: 0, hitstunFrames: frames }));

  it('keeps a press for the buffer frames and plays it as soon as the fighter can act', () => {
    let state = stunnedThenPress(INPUT.bufferFrames);
    expect(fighter(state, 0).buffer).toMatchObject({ action: 'jab', age: 0 });
    state = run(state, INPUT.bufferFrames, [NONE]);
    expect(fighter(state, 0).moveId).toBe('jab');
    expect(fighter(state, 0).buffer).toBeNull();
  });

  it('starts a buffered back attack facing back, even if the fighter turned in between', () => {
    // Facing right in jab 1, back + attack (a forward tilt aimed behind) is buffered; the stick
    // stays back as jab 1 ends.
    let state = withFighter(settled(), 0, { facing: 1 });
    state = until(press(state), 'jab', findMove('jab').totalFrames - 3);
    state = press(state, inputOf({ x: -0.5, attack: true }));
    state = run(state, 4, [inputOf({ x: -0.5 })]);
    expect(fighter(state, 0)).toMatchObject({
      action: 'attack',
      moveId: 'forwardTilt',
      facing: -1,
    });
  });

  it('drops a press for an empty slot, so a jump on the same frame still happens', () => {
    const airborne = withFighter(settled(), 0, {
      grounded: false,
      action: 'airborne',
      position: { x: 0, y: 6 },
      velocity: { x: 0, y: -0.1 },
      jumpsRemaining: 1,
    });
    const state = press(airborne, inputOf({ special: true, jump: true }));
    expect(fighter(state, 0).jumpsRemaining).toBe(0);
    expect(fighter(state, 0).velocity.y).toBeGreaterThan(0);
    expect(fighter(state, 0).buffer).toBeNull();
  });

  it('drops a press that is older than the buffer', () => {
    const state = run(stunnedThenPress(INPUT.bufferFrames + 2), INPUT.bufferFrames + 3, [NONE]);
    expect(fighter(state, 0).action).toBe('idle');
    expect(fighter(state, 0).buffer).toBeNull();
  });

  it('keeps a press made during hitlag without ageing it', () => {
    let state = withFighter(settled(), 0, { hitlagFrames: 10 });
    state = run(press(state), 9, [NONE]);
    expect(fighter(state, 0).buffer).toMatchObject({ action: 'jab', age: 0 });
    state = step(state, [NONE]);
    expect(fighter(state, 0).moveId).toBe('jab');
  });
});

describe('cancel data', () => {
  it('refuses a cancel window outside the move or onto an unknown move', () => {
    const jab = findMove('jab');
    const withCancel = (cancel: MoveDef['cancels'][number]): MoveDef => ({
      ...jab,
      cancels: [cancel],
    });
    expect(() => validateMove(withCancel({ on: 'jab', from: 10, to: 5 }))).toThrow(/cancel 0/);
    expect(() => validateMove(withCancel({ on: 'jab', from: 3, to: 99 }))).toThrow(/cancel 0/);
    expect(() => validateMoves([withCancel({ on: 'jab', into: 'jab9', from: 6, to: 9 })])).toThrow(
      /jab9/,
    );
    expect(() => validateMoves(Object.values(MOVES))).not.toThrow();
  });
});
