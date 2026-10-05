import { describe, expect, it } from 'vitest';
import { DI, STICK } from './config';
import { influence } from './di';
import { CAPSULE } from './registry';
import { createMatch, step } from './simulation';
import { FINAL_DESTINATION } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, PlayerInput, TrainingSettings } from './types';

const NONE = inputOf({});
const SMASH = inputOf({ x: 1, attack: true });

const angleOf = ({ x, y }: { x: number; y: number }): number => (Math.atan2(y, x) * 180) / Math.PI;
const speedOf = ({ x, y }: { x: number; y: number }): number => Math.hypot(x, y);

/** A launch up and to the right at 45 degrees. */
const LAUNCH = { x: Math.SQRT1_2 * 0.6, y: Math.SQRT1_2 * 0.6 };

describe('directional influence on a launch (#154)', () => {
  it('leaves the launch alone with the stick centred or inside the deadzone', () => {
    expect(influence(LAUNCH, { x: 0, y: 0 })).toEqual(LAUNCH);
    const inside = STICK.deadzone * 0.9;
    expect(influence(LAUNCH, { x: -inside * Math.SQRT1_2, y: inside * Math.SQRT1_2 })).toEqual(
      LAUNCH,
    );
  });

  it('leaves the angle alone with the stick held along the launch, or against it', () => {
    for (const stick of [
      { x: 1, y: 1 },
      { x: -1, y: -1 },
    ]) {
      const bent = influence(LAUNCH, stick);
      expect(angleOf(bent)).toBeCloseTo(45, 9);
      expect(speedOf(bent)).toBeCloseTo(0.6, 9);
    }
  });

  it(`bends it by the full ${DI.maxDegrees} degrees with the stick held across it`, () => {
    // Up and to the left is 90 degrees counter-clockwise from the launch: towards a higher angle.
    const left = influence(LAUNCH, { x: -Math.SQRT1_2, y: Math.SQRT1_2 });
    expect(angleOf(left)).toBeCloseTo(45 + DI.maxDegrees, 9);
    const right = influence(LAUNCH, { x: Math.SQRT1_2, y: -Math.SQRT1_2 });
    expect(angleOf(right)).toBeCloseTo(45 - DI.maxDegrees, 9);
    // DI turns a launch; it does not make it stronger or weaker.
    expect(speedOf(left)).toBeCloseTo(0.6, 9);
  });

  it('bends it by less for a stick held partly across it, or only partly pushed', () => {
    const diagonal = influence(LAUNCH, { x: 0, y: 1 });
    expect(angleOf(diagonal)).toBeCloseTo(45 + DI.maxDegrees * Math.SQRT1_2, 9);
    const half = influence(LAUNCH, { x: -Math.SQRT1_2 / 2, y: Math.SQRT1_2 / 2 });
    expect(angleOf(half)).toBeCloseTo(45 + DI.maxDegrees / 2, 9);
  });

  it('counts a keyboard diagonal as a full push, not more', () => {
    expect(angleOf(influence(LAUNCH, { x: -1, y: 1 }))).toBeCloseTo(45 + DI.maxDegrees, 9);
  });
});

/** P1 (capsule) at the centre of Final Destination facing right, P2 (`target`) in front of it. */
const faceOff = (damage: number, training?: TrainingSettings): MatchState => {
  let state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
      ...(training && { training }),
    }),
    120,
  );
  state = withFighter(state, 0, {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    grounded: true,
    action: 'idle',
  });
  return withFighter(state, 1, {
    position: { x: 0.9, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: -1,
    grounded: true,
    action: 'idle',
    damage,
  });
};

/**
 * P1 forward smashes; P2 holds `hitlagStick` while frozen by the hit (`lastFrameOnly`: only on
 * its last frame of hitlag, centred before) and `NONE` after. The state once hitlag is over.
 */
const smashed = (
  damage: number,
  hitlagStick: PlayerInput = NONE,
  { lastFrameOnly = false } = {},
): MatchState => {
  let state = step(faceOff(damage), [SMASH, NONE]);
  for (let i = 0; i < 60 && !state.events.some((e) => e.type === 'hit'); i += 1) {
    state = step(state, [NONE, NONE]);
  }
  while (fighter(state, 1).hitlagFrames > 0) {
    const last = fighter(state, 1).hitlagFrames === 1;
    state = step(state, [NONE, !lastFrameOnly || last ? hitlagStick : NONE]);
  }
  return state;
};

const launchAngle = (state: MatchState): number => angleOf(fighter(state, 1).knockback);

/** Whether P2 leaves through the side or top of the blast zone. */
const kos = (state: MatchState): boolean => {
  let next = state;
  for (let frame = 0; frame < 400; frame += 1) {
    const before = fighter(next, 1).position;
    next = step(next, [NONE, NONE]);
    if (fighter(next, 1).falls > 0) return before.y > state.stage.blastZone.bottom + 1;
  }
  return false;
};

/** The lowest percent, in steps of 5, at which the smash KOs with `stick` held in hitlag. */
const koPercent = (stick: PlayerInput): number => {
  for (let damage = 50; damage <= 250; damage += 5) {
    if (kos(smashed(damage, stick))) return damage;
  }
  return Infinity;
};

describe('DI in a match (#154)', () => {
  it('reads the stick on the last frame of hitlag', () => {
    const plain = launchAngle(smashed(80));
    const upAndIn = inputOf({ x: -1, y: 1 });
    expect(launchAngle(smashed(80, upAndIn, { lastFrameOnly: true }))).toBeGreaterThan(plain + 10);
  });

  it('ignores a stick let go before the last frame of hitlag', () => {
    const plain = launchAngle(smashed(80));
    let state = step(faceOff(80), [SMASH, NONE]);
    for (let i = 0; i < 60 && !state.events.some((e) => e.type === 'hit'); i += 1) {
      state = step(state, [NONE, NONE]);
    }
    while (fighter(state, 1).hitlagFrames > 0) {
      const last = fighter(state, 1).hitlagFrames === 1;
      state = step(state, [NONE, last ? NONE : inputOf({ x: -1, y: 1 })]);
    }
    expect(launchAngle(state)).toBeCloseTo(plain, 9);
  });

  it('keeps a fighter alive longer with survival DI, up and in', () => {
    const none = koPercent(NONE);
    expect(koPercent(inputOf({ x: -1, y: 1 }))).toBeGreaterThanOrEqual(none + 10);
  });

  it('sends a fighter lower and further with combo DI, away and down', () => {
    expect(launchAngle(smashed(80, inputOf({ x: 1, y: -1 })))).toBeLessThan(
      launchAngle(smashed(80)) - 10,
    );
  });
});

describe('the training dummy holds a DI direction (#154)', () => {
  const settings = (di: TrainingSettings['di']): TrainingSettings => ({
    dummy: 1,
    behaviour: 'stand',
    di,
    percent: 80,
    freezePercent: false,
  });

  const dummySmashed = (di: TrainingSettings['di']): number => {
    let state = step(faceOff(80, settings(di)), [SMASH, NONE]);
    for (let i = 0; i < 60 && !state.events.some((e) => e.type === 'hit'); i += 1) {
      state = step(state, [NONE, NONE]);
    }
    while (fighter(state, 1).hitlagFrames > 0) state = step(state, [NONE, NONE]);
    return launchAngle(state);
  };

  it('bends the launch towards the stage and up with survival DI, away with combo DI', () => {
    const none = dummySmashed('none');
    expect(dummySmashed('survival')).toBeGreaterThan(none + 10);
    expect(dummySmashed('combo')).toBeLessThan(none - 10);
  });
});
