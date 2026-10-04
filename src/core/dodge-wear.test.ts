import { describe, expect, it } from 'vitest';
import { DODGE } from './config';
import { step } from './simulation';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { FighterAction, MatchState, PlayerInput } from './types';

const NONE = inputOf({});
const SIDESTEP = inputOf({ shield: true });
const ROLL = inputOf({ x: 1, shield: true });
const DODGES: readonly FighterAction[] = [
  'sidestepIn',
  'sidestepOut',
  'forwardRoll',
  'backRoll',
  'airDodge',
];
const { repeat } = DODGE;

/** P1 standing in the middle of the main stage, P2 far away. */
const standing = (): MatchState => {
  const state = withFighter(settled(), 0, {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    grounded: true,
    action: 'idle',
  });
  return withFighter(state, 1, { position: { x: -6, y: 0 }, velocity: { x: 0, y: 0 } });
};

interface Dodge {
  /** Frames the dodge lasted, from the press until control came back. */
  readonly frames: number;
  /** Frames on which it could not be hit. */
  readonly invulnerable: number;
  readonly state: MatchState;
}

/** Presses `press` and plays the dodge out; returns its frames and the state once it is over. */
const playDodge = (state: MatchState, press: PlayerInput = SIDESTEP): Dodge => {
  let now = step(state, [press]);
  expect(DODGES).toContain(fighter(now, 0).action);
  let frames = 1;
  let invulnerable = 0;
  while (DODGES.includes(fighter(now, 0).action)) {
    if (fighter(now, 0).invulnerableFrames > 0) invulnerable += 1;
    now = step(now, [NONE]);
    frames += 1;
  }
  return { frames: frames - 1, invulnerable, state: now };
};

/** Dodges `count` times in a row, each as soon as the last one ends. */
const inARow = (count: number, press: PlayerInput = SIDESTEP): Dodge[] => {
  const dodges: Dodge[] = [];
  let state = standing();
  for (let i = 0; i < count; i += 1) {
    const dodge = playDodge(state, press);
    dodges.push(dodge);
    state = dodge.state;
  }
  return dodges;
};

const fullInvulnerable = DODGE.sidestep.invulnerableTo - DODGE.sidestep.invulnerableFrom;

describe('repeated dodges get weaker (#150)', () => {
  it('keeps the first dodge at full strength', () => {
    const [first] = inARow(1);
    expect(first?.frames).toBe(DODGE.sidestep.totalFrames);
    expect(first?.invulnerable).toBe(fullInvulnerable);
  });

  it('gives a second dodge in a row fewer invulnerable frames and more endlag', () => {
    const [, second] = inARow(2);
    expect(second?.invulnerable).toBe(fullInvulnerable - repeat.invulnerableLoss);
    expect(second?.frames).toBe(DODGE.sidestep.totalFrames + repeat.extraFrames);
  });

  it('weakens a third dodge in a row further', () => {
    const [, , third] = inARow(3);
    expect(third?.invulnerable).toBe(fullInvulnerable - 2 * repeat.invulnerableLoss);
    expect(third?.frames).toBe(DODGE.sidestep.totalFrames + 2 * repeat.extraFrames);
  });

  it('stops at a floor: dodges after the last weakening are no weaker', () => {
    const dodges = inARow(repeat.maxLevel + 3);
    const floor = dodges[repeat.maxLevel];
    for (const later of dodges.slice(repeat.maxLevel + 1)) {
      expect(later).toMatchObject({ frames: floor?.frames, invulnerable: floor?.invulnerable });
    }
    expect(floor?.invulnerable).toBe(fullInvulnerable - repeat.maxLevel * repeat.invulnerableLoss);
    expect(floor?.invulnerable).toBeGreaterThan(0);
  });

  it('wears off after wearOffFrames without dodging', () => {
    const [, , third] = inARow(3);
    const rested = playDodge(run(third?.state ?? standing(), repeat.wearOffFrames, [NONE]));
    expect(rested.invulnerable).toBe(fullInvulnerable);
    expect(rested.frames).toBe(DODGE.sidestep.totalFrames);
  });

  it('still counts a dodge one frame before the wear-off as repeated', () => {
    const [first] = inARow(1);
    const early = playDodge(run(first?.state ?? standing(), repeat.wearOffFrames - 1, [NONE]));
    expect(early.invulnerable).toBe(fullInvulnerable - repeat.invulnerableLoss);
  });

  it('counts the time hanging on a ledge as time without dodging', () => {
    const [, second] = inARow(2);
    const hanging = withFighter(second?.state ?? standing(), 0, {
      action: 'ledge',
      actionFrame: 0,
      ledge: 0,
      grounded: false,
    });
    const rested = run(hanging, repeat.wearOffFrames, [NONE]);
    expect(fighter(rested, 0).dodgeRestFrames).toBe(repeat.wearOffFrames);
  });

  it('counts an air dodge that ends on the frame it starts, by landing at once', () => {
    let state = withFighter(standing(), 0, {
      position: { x: 0, y: 0.1 },
      velocity: { x: 0, y: -0.2 },
      grounded: false,
      action: 'airborne',
    });
    state = step(state, [inputOf({ y: -1, shield: true })]);
    expect(fighter(state, 0)).toMatchObject({ grounded: true, action: 'landing' });
    while (fighter(state, 0).action === 'landing') state = step(state, [NONE]);
    expect(playDodge(state).invulnerable).toBe(fullInvulnerable - repeat.invulnerableLoss);
  });

  it('weakens rolls the same way, and the roll still covers its distance', () => {
    const [first, second] = inARow(2, ROLL);
    const fullRoll = DODGE.roll.invulnerableTo - DODGE.roll.invulnerableFrom;
    expect(first).toMatchObject({ frames: DODGE.roll.totalFrames, invulnerable: fullRoll });
    expect(second).toMatchObject({
      frames: DODGE.roll.totalFrames + repeat.extraFrames,
      invulnerable: fullRoll - repeat.invulnerableLoss,
    });
    const from = fighter(first?.state ?? standing(), 0).position.x;
    const to = fighter(second?.state ?? standing(), 0).position.x;
    expect(Math.abs(to - from)).toBeCloseTo(DODGE.roll.distance, 6);
  });

  it('counts every kind together: an air dodge right after a sidestep is weaker', () => {
    const [sidestep] = inARow(1);
    let state = step(sidestep?.state ?? standing(), [inputOf({ jump: true })]);
    while (fighter(state, 0).grounded) state = step(state, [NONE]);
    state = run(state, 4, [NONE]);
    const air = playDodge(state);
    const fullAir = DODGE.air.invulnerableTo - DODGE.air.invulnerableFrom;
    expect(air.invulnerable).toBe(fullAir - repeat.invulnerableLoss);
  });

  it('makes nonstop rolling punishable: the vulnerable endlag grows', () => {
    const [first, , third] = inARow(3, ROLL);
    const endlag = (d: Dodge | undefined) => (d?.frames ?? 0) - (d?.invulnerable ?? 0);
    expect(endlag(third)).toBeGreaterThan(endlag(first) + repeat.extraFrames);
  });
});
