import { describe, expect, it } from 'vitest';
import { DODGE, FIGHTER } from './config';
import { findMove } from './move-data';
import { moveTiming } from './moves';
import { step } from './simulation';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

const NONE = inputOf({});
const DODGE_PRESS = inputOf({ shield: true });

/** P1 standing on the main stage at `x`, facing right; P2 far away unless placed. */
const standing = (x = 0, facing: 1 | -1 = 1): MatchState => {
  let state = withFighter(settled(), 0, {
    position: { x, y: 0 },
    velocity: { x: 0, y: 0 },
    facing,
    grounded: true,
    action: 'idle',
  });
  state = withFighter(state, 1, {
    position: { x: -5, y: 0 },
    velocity: { x: 0, y: 0 },
    grounded: true,
    action: 'idle',
  });
  return state;
};

/** P1 presses the dodge button with the stick at `stick` and lets go of both. */
const dodge = (state: MatchState, stick: Partial<PlayerInput> = {}): MatchState =>
  step(state, [inputOf({ ...stick, shield: true })]);

/** The frames of a dodge on which P1 cannot be hit. */
const invulnerableFrames = (state: MatchState): number[] => {
  const frames: number[] = [];
  let next = state;
  while (['spotDodge', 'forwardRoll', 'backRoll'].includes(fighter(next, 0).action)) {
    if (fighter(next, 0).invulnerableFrames > 0) frames.push(fighter(next, 0).actionFrame);
    next = step(next, [NONE]);
  }
  return frames;
};

/** Frames `from` up to (not including) `to`. */
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

describe('spot dodge', () => {
  it('starts from the dodge button with the stick centred or held down', () => {
    for (const stick of [{}, { y: -1 }]) {
      const state = dodge(standing(), stick);
      expect(fighter(state, 0)).toMatchObject({ action: 'spotDodge', actionFrame: 0, facing: 1 });
    }
  });

  it('stays on a pass-through platform when the stick is held down', () => {
    let state = withFighter(standing(), 0, { position: { x: 3, y: 2.2 } });
    state = dodge(state, { y: -1 });
    state = run(state, DODGE.spot.totalFrames, [inputOf({ y: -1, shield: true })]);
    expect(fighter(state, 0)).toMatchObject({ grounded: true, position: { x: 3, y: 2.2 } });
  });

  it('lasts 22 frames in place, then hands control back', () => {
    let state = dodge(standing(1));
    state = run(state, 21, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'spotDodge', actionFrame: 21 });
    expect(fighter(state, 0).position.x).toBe(1);
    state = step(state, [NONE]);
    expect(fighter(state, 0).action).toBe('idle');
  });

  it('cannot be hit on frames 2 to 16', () => {
    expect(invulnerableFrames(dodge(standing()))).toEqual(range(2, 17));
  });

  it('keeps a longer invulnerability after a respawn', () => {
    const state = dodge(withFighter(standing(), 0, { invulnerableFrames: 100 }));
    expect(invulnerableFrames(state)).toEqual(range(0, DODGE.spot.totalFrames));
  });
});

describe('roll', () => {
  it('rolls the way the stick points; only a forward roll turns around', () => {
    const forward = dodge(standing(0, 1), { x: 1 });
    expect(fighter(forward, 0)).toMatchObject({ action: 'forwardRoll', actionFrame: 0 });
    const away = dodge(standing(0, 1), { x: -1 });
    expect(fighter(away, 0)).toMatchObject({ action: 'backRoll', actionFrame: 0 });

    const end = (state: MatchState) => fighter(run(state, DODGE.roll.totalFrames, [NONE]), 0);
    expect(end(forward).position.x).toBeCloseTo(2.2, 9);
    expect(end(forward).facing).toBe(-1);
    expect(end(away).position.x).toBeCloseTo(-2.2, 9);
    expect(end(away).facing).toBe(1);
  });

  it('needs a clear push to roll; a light touch spot dodges', () => {
    expect(fighter(dodge(standing(), { x: 0.3 }), 0).action).toBe('spotDodge');
    expect(fighter(dodge(standing(), { x: 0.6 }), 0).action).toBe('forwardRoll');
  });

  it('lasts 30 frames, then hands control back standing still', () => {
    let state = dodge(standing(), { x: 1 });
    state = run(state, 29, [NONE]);
    expect(fighter(state, 0).action).toBe('forwardRoll');
    state = step(state, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'idle', velocity: { x: 0 } });
  });

  it('cannot be hit on frames 4 to 18', () => {
    expect(invulnerableFrames(dodge(standing(), { x: 1 }))).toEqual(range(4, 19));
  });

  it('stops at the edge instead of rolling off', () => {
    let state = dodge(standing(6), { x: 1 });
    state = run(state, DODGE.roll.totalFrames, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ grounded: true, action: 'idle' });
    expect(fighter(state, 0).position.x).toBe(7);
  });
});

describe('dodging attacks', () => {
  const jab = findMove('jab');
  const { startupFrames, activeFrames } = moveTiming(jab);

  /**
   * P2 jabs P1 from the right; P1 spot dodges first and P2 presses attack `delay` frames later,
   * so the jab's first active frame meets dodge frame `delay + startupFrames`.
   */
  const jabIntoDodge = (delay: number) => {
    let state = withFighter(standing(0), 1, { position: { x: 0.8, y: 0 }, facing: -1 });
    state = step(state, [DODGE_PRESS, NONE]);
    state = run(state, delay - 1, [NONE, NONE]);
    state = step(state, [NONE, inputOf({ attack: true })]);
    state = run(state, jab.totalFrames, [NONE, NONE]);
    return fighter(state, 0).damage > 0;
  };

  it('lets a jab pass through when all its active frames meet the invulnerable ones', () => {
    const lastActive = activeFrames - 1;
    for (const delay of range(2 - startupFrames, 17 - startupFrames - lastActive).filter(
      (d) => d >= 1,
    )) {
      expect(jabIntoDodge(delay), `dodge frame ${delay + startupFrames}`).toBe(false);
    }
  });

  it('can be punished in its recovery, from its first vulnerable frame on', () => {
    for (const delay of range(17 - startupFrames, 22 - startupFrames)) {
      expect(jabIntoDodge(delay), `dodge frame ${delay + startupFrames}`).toBe(true);
    }
  });
});

describe('roll direction', () => {
  /** The facing on every frame of P1's roll, and where it ends. */
  const rollFacings = (state: MatchState) => {
    const facings = new Set<number>();
    let next = state;
    while (['forwardRoll', 'backRoll'].includes(fighter(next, 0).action)) {
      facings.add(fighter(next, 0).facing);
      next = step(next, [NONE]);
    }
    return { facings: [...facings], end: fighter(next, 0) };
  };

  it('slides backwards, still facing the same way, when rolling away from the facing', () => {
    const state = dodge(standing(0, -1), { x: 1 });
    expect(fighter(state, 0).action).toBe('backRoll');
    const { facings, end } = rollFacings(state);
    expect(facings).toEqual([-1]);
    expect(end.facing).toBe(-1);
    expect(end.position.x).toBeCloseTo(DODGE.roll.distance, 9);
  });

  it('rolls forward facing ahead, and turns around at the end, as in Melee', () => {
    const state = dodge(standing(0, 1), { x: 1 });
    expect(fighter(state, 0).action).toBe('forwardRoll');
    const { facings, end } = rollFacings(state);
    expect(facings).toEqual([1]);
    expect(end.facing).toBe(-1);
    expect(end.position.x).toBeCloseTo(DODGE.roll.distance, 9);
  });

  it('still slides backwards when the stick turned the fighter just before the dodge', () => {
    // On a keyboard, the direction key often lands a frame or two before the dodge key.
    let state = run(standing(0, -1), 2, [inputOf({ x: 1 })]);
    expect(fighter(state, 0).facing).toBe(1);
    state = dodge(state, { x: 1 });
    expect(fighter(state, 0)).toMatchObject({ action: 'backRoll', facing: -1 });
    expect(rollFacings(state).end.facing).toBe(-1);
  });

  it('still slides backwards after a quick wiggle of the stick', () => {
    let state = step(standing(0, -1), [inputOf({ x: 1 })]);
    state = step(state, [inputOf({ x: -1 })]);
    state = dodge(state, { x: 1 });
    expect(fighter(state, 0)).toMatchObject({ action: 'backRoll', facing: -1 });
  });

  it('counts the turn for exactly the grace frames', () => {
    const after = (frames: number) =>
      fighter(dodge(run(standing(0, -1), frames, [inputOf({ x: 1 })]), { x: 1 }), 0).action;
    expect(after(DODGE.turnGraceFrames)).toBe('backRoll');
    expect(after(DODGE.turnGraceFrames + 1)).toBe('forwardRoll');
  });

  it('rolls forward after running that way for a while', () => {
    let state = run(standing(0, -1), DODGE.turnGraceFrames + 2, [inputOf({ x: 1 })]);
    state = dodge(state, { x: 1 });
    expect(fighter(state, 0)).toMatchObject({ action: 'forwardRoll', facing: 1 });
  });
});

describe('punishing a roll', () => {
  const { startupFrames } = moveTiming(findMove('jab'));

  /**
   * P1 is on roll frame `frame`, rolling towards P2, who jabs on the next step. The roll carries
   * P1 to about jab range from P2 by the time the jab comes out.
   */
  const jabIntoRoll = (frame: number) => {
    let state = withFighter(standing(0, -1), 0, { action: 'backRoll', actionFrame: frame });
    state = withFighter(state, 1, { position: { x: 1.4, y: 0 }, facing: -1 });
    state = step(state, [NONE, inputOf({ attack: true })]);
    state = run(state, findMove('jab').totalFrames, [NONE, NONE]);
    return fighter(state, 0).damage > 0;
  };

  it('lets a jab pass through early in the roll', () => {
    expect(jabIntoRoll(DODGE.roll.invulnerableFrom)).toBe(false);
  });

  it('can be punished in the roll recovery', () => {
    expect(jabIntoRoll(DODGE.roll.invulnerableTo - startupFrames)).toBe(true);
  });
});

describe('dodge input', () => {
  it('waits in the buffer while the fighter is busy and starts as soon as it can', () => {
    let state = step(standing(), [inputOf({ attack: true })]);
    const jabFrames = findMove('jab').totalFrames;
    state = run(state, jabFrames - 4, [NONE]);
    state = step(state, [DODGE_PRESS]);
    state = run(state, 4, [NONE]);
    expect(fighter(state, 0).action).toBe('spotDodge');
  });

  it('buffers an attack pressed late in the dodge', () => {
    let state = dodge(standing());
    state = run(state, DODGE.spot.totalFrames - 3, [NONE]);
    state = step(state, [inputOf({ attack: true })]);
    state = run(state, 3, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: 'jab' });
  });

  it('is not a drop through the platform when pressed with the stick down', () => {
    let state = withFighter(standing(), 0, { position: { x: 3, y: 2.2 } });
    state = step(state, [inputOf({ y: -1, shield: true })]);
    expect(fighter(state, 0).grounded).toBe(true);
  });

  it('is not a drop through the platform when buffered and started later with the stick down', () => {
    let state = withFighter(standing(), 0, { position: { x: 3, y: 2.2 } });
    state = step(state, [inputOf({ attack: true })]);
    state = run(state, findMove('jab').totalFrames - 4, [NONE]);
    state = run(state, 5, [inputOf({ y: -1, shield: true })]);
    expect(fighter(state, 0)).toMatchObject({ action: 'spotDodge', grounded: true });
    expect(fighter(state, 0).position.y).toBe(2.2);
  });

  it('leaves jumps alone', () => {
    const state = dodge(standing());
    expect(fighter(state, 0).jumpsRemaining).toBe(FIGHTER.totalJumps);
  });
});
