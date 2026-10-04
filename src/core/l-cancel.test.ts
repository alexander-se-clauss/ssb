import { describe, expect, it } from 'vitest';
import { FIGHTER, L_CANCEL } from './config';
import { findMove } from './move-data';
import { createMatch, step } from './simulation';
import { FINAL_DESTINATION } from './stages';
import { CAPSULE, RIVET } from './registry';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { FighterState, MatchState, PlayerInput } from './types';

const NONE = inputOf({});
const DODGE = inputOf({ shield: true });

/**
 * P1 alone on Final Destination, `y` above the stage, at rest in `moveId` on `actionFrame`. High
 * enough that it lands between the aerial's auto-cancel windows (#148), where its own landing lag
 * counts.
 */
const inAerial = (
  moveId: string,
  actionFrame: number,
  y: number,
  characterId: string = CAPSULE.id,
): MatchState => {
  const state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [{ characterId }],
      rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
      countdownFrames: 0,
    }),
    120,
  );
  return withFighter(state, 0, {
    position: { x: 0, y },
    velocity: { x: 0, y: 0 },
    grounded: false,
    action: 'attack',
    moveId,
    actionFrame,
    hitTargets: [],
    facing: 1,
    buffer: null,
  });
};

const fair = (): MatchState => inAerial('forwardAir', 8, 1);
/** A long fall in dair, long enough to press twice with the lockout over in between. */
const longDair = (): MatchState => inAerial('downAir', 6, 6);

/** Steps until P1 lands with nothing pressed: the step that lands is number `n`. */
const stepsToLand = (state: MatchState): number => {
  let now = state;
  for (let n = 1; n < 200; n += 1) {
    now = step(now, [NONE]);
    if (fighter(now, 0).grounded) return n;
  }
  throw new Error('P1 never landed');
};

/**
 * Lets P1 fall until it lands, pressing dodge `early` frames before the landing step for every
 * entry of `presses` (0 is on the landing step itself), with the button let go in between.
 */
const land = (state: MatchState, presses: readonly number[]): FighterState => {
  const steps = stepsToLand(state);
  let now = state;
  for (let n = 1; n <= steps; n += 1) {
    const input: PlayerInput = presses.includes(steps - n) ? DODGE : NONE;
    now = step(now, [input]);
  }
  const landed = fighter(now, 0);
  expect(landed).toMatchObject({ grounded: true, action: 'landing' });
  return landed;
};

const halved = (lag: number): number => Math.max(Math.ceil(lag / 2), FIGHTER.landingLagFrames);

describe('L-cancel on the dodge button (#149)', () => {
  it('lands the test aerials between their auto-cancel windows', () => {
    for (const [state, id] of [
      [fair(), 'forwardAir'],
      [longDair(), 'downAir'],
    ] as const) {
      const move = findMove(id);
      const landsOn = fighter(state, 0).actionFrame + stepsToLand(state);
      expect(landsOn).toBeGreaterThanOrEqual(move.autoCancel?.before ?? 0);
      expect(landsOn).toBeLessThan(move.autoCancel?.after ?? 0);
    }
    expect(stepsToLand(longDair())).toBeGreaterThan(L_CANCEL.lockoutFrames + L_CANCEL.windowFrames);
  });

  it('halves the landing lag of a fair when dodge is pressed within 7 frames of landing', () => {
    const lag = findMove('forwardAir').landingLag ?? 0;
    expect(L_CANCEL.windowFrames).toBe(7);
    for (const early of [0, 3, L_CANCEL.windowFrames - 1]) {
      const landed = land(fair(), [early]);
      expect(landed.landingLagFrames, `pressed ${early} early`).toBe(halved(lag));
      expect(landed.lastLanding).toBe('lCancelled');
    }
  });

  it('halves every aerial, but never below the normal landing lag', () => {
    for (const id of ['neutralAir', 'forwardAir', 'backAir', 'upAir', 'downAir']) {
      const move = findMove(id);
      const state = inAerial(id, move.autoCancel?.before ?? 0, 0.6);
      const landed = land(state, [1]);
      expect(landed.landingLagFrames, id).toBe(halved(move.landingLag ?? 0));
      expect(landed.landingLagFrames, id).toBeLessThan(move.landingLag ?? 0);
    }
  });

  it('misses with a press more than 7 frames before landing: the full landing lag', () => {
    const landed = land(fair(), [L_CANCEL.windowFrames]);
    expect(landed.landingLagFrames).toBe(findMove('forwardAir').landingLag);
    expect(landed.lastLanding).toBe('missed');
  });

  it('counts a landing without any press as missed', () => {
    const landed = land(fair(), []);
    expect(landed.landingLagFrames).toBe(findMove('forwardAir').landingLag);
    expect(landed.lastLanding).toBe('missed');
  });

  it('ignores a new press during the lockout, so mashing misses', () => {
    // Pressed every other frame from 15 frames out: the first press is too early, the rest locked out.
    const mash = Array.from({ length: 8 }, (_, i) => 15 - 2 * i);
    const landed = land(longDair(), mash);
    expect(landed.landingLagFrames).toBe(findMove('downAir').landingLag);
    expect(landed.lastLanding).toBe('missed');

    const twice = land(longDair(), [L_CANCEL.lockoutFrames - 1 + 3, 3]);
    expect(twice.lastLanding).toBe('missed');
  });

  it('counts a new press again once the lockout is over', () => {
    const landed = land(longDair(), [L_CANCEL.lockoutFrames + 3, 3]);
    expect(landed.landingLagFrames).toBe(halved(findMove('downAir').landingLag ?? 0));
    expect(landed.lastLanding).toBe('lCancelled');
  });

  it('never air dodges on a dodge press during an aerial, not even once the aerial ends', () => {
    const state = inAerial('neutralAir', 0, 12);
    const nair = findMove('neutralAir');
    let now = state;
    // Pressed on every other frame of the aerial, up to the frame it ends.
    for (let frame = 0; frame < nair.totalFrames + 4; frame += 1) {
      const mashing = fighter(now, 0).action === 'attack' && frame % 2 === 0;
      now = step(now, [mashing ? DODGE : NONE]);
      expect(fighter(now, 0).action, `frame ${frame}`).not.toBe('airDodge');
    }
    expect(fighter(now, 0)).toMatchObject({ action: 'airborne', airDodgeUsed: false });
    // The fall is not changed by it either.
    const untouched = run(state, nair.totalFrames + 4, [NONE]);
    expect(fighter(now, 0).position.y).toBeCloseTo(fighter(untouched, 0).position.y, 9);
    // Pressed again out of the aerial, it is an air dodge as usual.
    expect(fighter(step(step(now, [NONE]), [DODGE]), 0).action).toBe('airDodge');
  });

  it('leaves an auto-cancelled landing at the normal lag and says so', () => {
    const nair = findMove('neutralAir');
    const state = inAerial('neutralAir', 0, 0.05);
    const landed = land(state, [0]);
    expect(landed.actionFrame).toBe(0);
    expect(landed.landingLagFrames).toBe(FIGHTER.landingLagFrames);
    expect(landed.lastLanding).toBe('autoCancelled');
    expect(nair.autoCancel?.before).toBeGreaterThan(1);
  });

  it('does not carry a press over to a later aerial after landing', () => {
    let state = inAerial('forwardAir', 8, 1);
    const steps = stepsToLand(state);
    // Pressed one frame before landing, used up by that landing.
    state = run(state, steps - 1, [NONE]);
    state = step(state, [DODGE]);
    expect(fighter(state, 0).lastLanding).toBe('lCancelled');
    const again = land(
      withFighter(state, 0, {
        position: { x: 0, y: 1 },
        grounded: false,
        action: 'attack',
        moveId: 'forwardAir',
        actionFrame: 8,
        hitTargets: [],
      }),
      [],
    );
    expect(again.lastLanding).toBe('missed');
  });

  it('only aerials: a recovery move landing keeps its own lag', () => {
    const springJack = findMove('springJack');
    const state = inAerial('springJack', 10, 0.01, RIVET.id);
    const landed = land(state, [0]);
    expect(landed.landingLagFrames).toBe(springJack.landingLag);
  });
});
