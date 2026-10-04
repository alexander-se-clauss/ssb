import { describe, expect, it } from 'vitest';
import { DODGE, FIGHTER } from './config';
import { findMove } from './move-data';
import { moveTiming } from './moves';
import { step } from './simulation';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

const NONE = inputOf({});

/** P1 high above the right of the main stage, clear of the platforms; P2 far away. */
const inTheAir = (patch: Parameters<typeof withFighter>[2] = {}): MatchState => {
  let state = withFighter(settled(), 0, {
    position: { x: 6, y: 5 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    grounded: false,
    action: 'airborne',
    jumpsRemaining: FIGHTER.airJumps,
    ...patch,
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
const airDodge = (state: MatchState, stick: Partial<PlayerInput> = {}): MatchState =>
  step(state, [inputOf({ ...stick, shield: true })]);

/** Where P1 is once the air dodge has stopped carrying it, relative to where it started. */
const travel = (stick: Partial<PlayerInput>) => {
  const start = inTheAir();
  const state = run(airDodge(start, stick), DODGE.air.moveTo - 1, [NONE]);
  const from = fighter(start, 0).position;
  const to = fighter(state, 0).position;
  return { x: to.x - from.x, y: to.y - from.y };
};

/** Steps with no input until `done` holds (at most 200 frames). */
const until = (state: MatchState, done: (s: MatchState) => boolean): MatchState => {
  let next = state;
  for (let frame = 0; frame < 200 && !done(next); frame += 1) next = step(next, [NONE]);
  return next;
};

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

describe('air dodge', () => {
  it('starts from the dodge button in the air', () => {
    const state = airDodge(inTheAir());
    expect(fighter(state, 0)).toMatchObject({
      action: 'airDodge',
      actionFrame: 0,
      airDodgeUsed: true,
    });
  });

  it('holds the fighter in place without a direction', () => {
    const { x, y } = travel({});
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('carries the fighter the way the stick points, gravity paused', () => {
    const right = travel({ x: 1 });
    expect(right.x).toBeGreaterThan(1.5);
    expect(right.y).toBe(0);
    const left = travel({ x: -1 });
    expect(left.x).toBeCloseTo(-right.x, 9);
    const up = travel({ y: 1 });
    expect(up.y).toBeCloseTo(right.x, 9);
    expect(up.x).toBe(0);
  });

  it('goes as far diagonally as straight, at the stick’s angle', () => {
    const straight = travel({ x: 1 }).x;
    const diagonal = travel({ x: 0.7, y: -0.7 });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(straight, 9);
    expect(diagonal.x).toBeCloseTo(-diagonal.y, 9);
  });

  it('ignores a slight stick tilt and dodges in place', () => {
    const { x, y } = travel({ x: DODGE.air.directionStick - 0.05 });
    expect(Math.hypot(x, y)).toBe(0);
  });

  it('falls again once the dodge stops carrying the fighter', () => {
    let state = run(airDodge(inTheAir(), { x: 1 }), DODGE.air.moveTo + 10, [NONE]);
    expect(fighter(state, 0).action).toBe('airDodge');
    expect(fighter(state, 0).velocity.y).toBeLessThan(0);
    state = run(state, 1, [NONE]);
    expect(fighter(state, 0).position.y).toBeLessThan(5);
  });

  it('cannot be hit on frames 3 to 19', () => {
    const frames: number[] = [];
    let state = airDodge(inTheAir({ position: { x: 6, y: 10 } }));
    while (fighter(state, 0).action === 'airDodge') {
      if (fighter(state, 0).invulnerableFrames > 0) frames.push(fighter(state, 0).actionFrame);
      state = step(state, [NONE]);
    }
    expect(frames).toEqual(range(3, 20));
  });

  it('lasts its frames, then the fighter can act again in the air', () => {
    let state = airDodge(inTheAir({ position: { x: 6, y: 10 } }));
    state = run(state, DODGE.air.totalFrames - 1, [NONE]);
    expect(fighter(state, 0).action).toBe('airDodge');
    state = step(state, [NONE]);
    expect(fighter(state, 0).action).toBe('airborne');

    const jumped = step(state, [inputOf({ jump: true })]);
    expect(fighter(jumped, 0).velocity.y).toBeCloseTo(FIGHTER.airJumpVelocity - FIGHTER.gravity, 9);
    const attacked = step(state, [inputOf({ attack: true })]);
    expect(fighter(attacked, 0)).toMatchObject({ action: 'attack', moveId: 'neutralAir' });
  });

  it('is not kept from a press late in an aerial: that press L-cancels instead (#149)', () => {
    let state = step(inTheAir({ position: { x: 6, y: 10 } }), [inputOf({ attack: true })]);
    state = run(state, findMove('neutralAir').totalFrames - 4, [NONE]);
    state = airDodge(state);
    state = run(state, 4, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'airborne', airDodgeUsed: false });
  });
});

describe('once per airtime', () => {
  it('cannot air dodge again before landing', () => {
    let state = airDodge(inTheAir({ position: { x: 6, y: 10 } }));
    state = run(state, DODGE.air.totalFrames, [NONE]);
    state = airDodge(state);
    expect(fighter(state, 0)).toMatchObject({ action: 'airborne', buffer: null });
    // Not even after a double jump.
    state = step(state, [inputOf({ jump: true })]);
    state = airDodge(run(state, 5, [NONE]));
    expect(fighter(state, 0).action).toBe('airborne');
  });

  it('gets the air dodge back on landing', () => {
    let state = airDodge(inTheAir());
    state = until(state, (s) => fighter(s, 0).grounded);
    expect(fighter(state, 0).airDodgeUsed).toBe(false);
    state = until(state, (s) => fighter(s, 0).action === 'idle');
    state = step(state, [inputOf({ jump: true })]);
    state = until(state, (s) => !fighter(s, 0).grounded);
    state = airDodge(state);
    expect(fighter(state, 0).action).toBe('airDodge');
  });

  it('gets the air dodge back when hit', () => {
    let state = withFighter(settled(), 0, {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      facing: 1,
      grounded: true,
      action: 'idle',
    });
    state = withFighter(state, 1, {
      position: { x: 0.8, y: 0 },
      velocity: { x: 0, y: 0 },
      facing: -1,
      grounded: true,
      action: 'idle',
      airDodgeUsed: true,
    });
    state = run(state, moveTiming(findMove('jab')).startupFrames + 1, [inputOf({ attack: true })]);
    expect(fighter(state, 1)).toMatchObject({ action: 'hitstun', airDodgeUsed: false });
  });

  it('is fresh after landing and walking off an edge', () => {
    let state = airDodge(inTheAir({ position: { x: 6.5, y: 1 } }));
    state = until(state, (s) => fighter(s, 0).action === 'idle');
    state = run(state, 20, [inputOf({ x: 1 })]);
    expect(fighter(state, 0)).toMatchObject({ grounded: false, airDodgeUsed: false });
    state = airDodge(state);
    expect(fighter(state, 0).action).toBe('airDodge');
  });

  it('air dodges out of a jump when pressed during the jump squat', () => {
    let state = withFighter(inTheAir(), 0, {
      position: { x: 3, y: 0 },
      grounded: true,
      action: 'idle',
      jumpsRemaining: FIGHTER.airJumps + 1,
    });
    state = step(state, [inputOf({ jump: true })]);
    expect(fighter(state, 0).action).toBe('jumpsquat');
    state = step(state, [inputOf({ jump: true, x: 1, shield: true })]);
    state = until(state, (s) => fighter(s, 0).action !== 'jumpsquat');
    state = step(state, [inputOf({ x: 1 })]);
    expect(fighter(state, 0)).toMatchObject({ action: 'airDodge', airDodgeUsed: true });
    expect(fighter(state, 0).velocity.x).toBeGreaterThan(0.2);
  });
});

describe('landing in an air dodge', () => {
  it('ends the dodge with its own landing lag', () => {
    let state = airDodge(inTheAir({ position: { x: 3, y: 0.5 } }), { y: -1 });
    state = until(state, (s) => fighter(s, 0).grounded);
    expect(fighter(state, 0)).toMatchObject({
      action: 'landing',
      landingLagFrames: DODGE.air.landingLag,
    });
  });

  it('slides along the ground after a dodge angled into it', () => {
    let state = airDodge(inTheAir({ position: { x: 3, y: 0.3 } }), { x: 0.7, y: -0.7 });
    state = until(state, (s) => fighter(s, 0).grounded);
    expect(fighter(state, 0).velocity.x).toBeGreaterThan(0.1);
  });

  it('drops an air dodge still in the buffer on landing', () => {
    let state = step(inTheAir({ position: { x: 3, y: 0.3 }, velocity: { x: 0, y: -0.2 } }), [
      inputOf({ attack: true }),
    ]);
    state = airDodge(state);
    state = until(state, (s) => fighter(s, 0).grounded);
    expect(fighter(state, 0).buffer).toBeNull();
    state = run(state, 30, [NONE]);
    expect(fighter(state, 0).action).toBe('idle');
  });
});

describe('dodge button in the air', () => {
  it('passes through a platform when the dodge points down onto it', () => {
    let state = inTheAir({ position: { x: 3, y: 2.25 }, velocity: { x: 0, y: -0.1 } });
    state = airDodge(state, { y: -1 });
    expect(fighter(state, 0).grounded).toBe(false);
    expect(fighter(state, 0).position.y).toBeLessThan(2.2);
  });
});

describe('second jump after air actions', () => {
  it('jumps again as soon as the air dodge ends when jump is pressed late in it', () => {
    let state = airDodge(inTheAir({ position: { x: 6, y: 10 } }));
    state = run(state, DODGE.air.totalFrames - 3, [NONE]);
    state = step(state, [inputOf({ jump: true })]);
    state = run(state, 3, [NONE]);
    expect(fighter(state, 0).jumpsRemaining).toBe(FIGHTER.airJumps - 1);
    expect(fighter(state, 0).velocity.y).toBeGreaterThan(0);
  });

  it('jumps again right after an aerial when jump is pressed late in it', () => {
    let state = step(inTheAir({ position: { x: 6, y: 10 } }), [inputOf({ attack: true })]);
    state = run(state, findMove('neutralAir').totalFrames - 3, [NONE]);
    state = step(state, [inputOf({ jump: true })]);
    state = run(state, 3, [NONE]);
    expect(fighter(state, 0).jumpsRemaining).toBe(FIGHTER.airJumps - 1);
    expect(fighter(state, 0).velocity.y).toBeGreaterThan(0);
  });

  it('jumps again after an aerial when jump came with a press for an empty special', () => {
    let state = step(inTheAir({ position: { x: 6, y: 10 } }), [inputOf({ attack: true })]);
    state = run(state, findMove('neutralAir').totalFrames - 3, [NONE]);
    state = step(state, [inputOf({ jump: true, special: true })]);
    state = run(state, 3, [NONE]);
    expect(fighter(state, 0).jumpsRemaining).toBe(FIGHTER.airJumps - 1);
    expect(fighter(state, 0).velocity.y).toBeGreaterThan(0);
  });

  it('does not use the second jump at take-off for a jump pressed twice in the jump squat', () => {
    let state = withFighter(inTheAir(), 0, {
      position: { x: 3, y: 0 },
      grounded: true,
      action: 'idle',
      jumpsRemaining: FIGHTER.airJumps + 1,
    });
    state = step(state, [inputOf({ jump: true })]);
    state = step(state, [NONE]);
    state = step(state, [inputOf({ jump: true })]);
    state = run(state, 6, [NONE]);
    expect(fighter(state, 0)).toMatchObject({
      action: 'airborne',
      jumpsRemaining: FIGHTER.airJumps,
    });
  });

  it('keeps a buffered air dodge when jump is pressed after it in the jump squat', () => {
    let state = withFighter(inTheAir(), 0, {
      position: { x: 3, y: 0 },
      grounded: true,
      action: 'idle',
      jumpsRemaining: FIGHTER.airJumps + 1,
    });
    state = step(state, [inputOf({ jump: true })]);
    state = step(state, [inputOf({ shield: true })]);
    state = step(state, [inputOf({ jump: true })]);
    state = until(state, (s) => fighter(s, 0).action !== 'jumpsquat');
    state = step(state, [NONE]);
    expect(fighter(state, 0).action).toBe('airDodge');
  });

  it('drops a jump pressed in hitstun: jumping out of it needs a fresh press, as in Melee', () => {
    let state = inTheAir({ position: { x: 6, y: 10 } });
    state = withFighter(state, 0, { action: 'hitstun', actionFrame: 0, hitstunFrames: 4 });
    state = step(state, [inputOf({ jump: true })]);
    state = run(state, 6, [NONE]);
    expect(fighter(state, 0)).toMatchObject({
      action: 'airborne',
      jumpsRemaining: FIGHTER.airJumps,
    });
  });

  it('drops a jump pressed late in an aerial when the fighter lands', () => {
    let state = inTheAir({ position: { x: 3, y: 0.3 }, velocity: { x: 0, y: -0.1 } });
    state = step(state, [inputOf({ attack: true })]);
    state = step(state, [inputOf({ jump: true })]);
    state = until(state, (s) => fighter(s, 0).grounded);
    expect(fighter(state, 0).buffer).toBeNull();
  });

  it('drops a jump press when no jump is left', () => {
    let state = inTheAir({ position: { x: 6, y: 10 }, jumpsRemaining: 0 });
    state = step(state, [inputOf({ jump: true })]);
    expect(fighter(state, 0).buffer).toBeNull();
    // Not even while an aerial plays, where a buffered attack would otherwise wait.
    state = step(state, [inputOf({ attack: true })]);
    state = step(state, [inputOf({ jump: true })]);
    expect(fighter(state, 0).buffer).toBeNull();
  });
});
