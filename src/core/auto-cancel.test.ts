import { describe, expect, it } from 'vitest';
import { FIGHTER } from './config';
import { findMove } from './move-data';
import { validateMove, type MoveDef } from './moves';
import { CAPSULE } from './registry';
import { step } from './simulation';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';

const NONE = inputOf({});

/**
 * Melee-style auto-cancel windows (#148): landing on frames `[0, before)` or `[after, total)` of
 * an aerial costs only the normal landing lag; landing in between costs the aerial's own. Nair
 * and the quick aerials are safe, the heavy dair stays punishable.
 */
const PINNED = [
  { id: 'neutralAir', landingLag: 6, before: 4, after: 30 },
  { id: 'forwardAir', landingLag: 12, before: 6, after: 28 },
  { id: 'backAir', landingLag: 9, before: 5, after: 22 },
  { id: 'upAir', landingLag: 9, before: 4, after: 24 },
  { id: 'downAir', landingLag: 15, before: 6, after: 36 },
];

/** P1 a hair above the main stage, falling, in `moveId` on the frame before `frame`. */
const landsOnFrame = (moveId: string, frame: number) => {
  const state = withFighter(settled(), 0, {
    position: { x: 0, y: 0.05 },
    velocity: { x: 0, y: -0.2 },
    grounded: false,
    action: 'attack',
    moveId,
    actionFrame: frame - 1,
    hitTargets: [],
    facing: 1,
  });
  const landed = fighter(step(state, [NONE]), 0);
  expect(landed).toMatchObject({ grounded: true, action: 'landing', moveId: null });
  return landed.landingLagFrames;
};

describe('auto-cancel windows and landing lag (#148)', () => {
  it.each(PINNED)(
    '$id: landing lag $landingLag, auto-cancels before $before and from $after',
    ({ id, landingLag, before, after }) => {
      const move = findMove(id);
      expect(move.landingLag).toBe(landingLag);
      expect(move.autoCancel).toEqual({ before, after });
    },
  );

  it.each(PINNED)(
    '$id: landing in an auto-cancel window costs only the normal landing lag',
    ({ id, before, after }) => {
      expect(landsOnFrame(id, 0)).toBe(FIGHTER.landingLagFrames);
      expect(landsOnFrame(id, before - 1)).toBe(FIGHTER.landingLagFrames);
      expect(landsOnFrame(id, after)).toBe(FIGHTER.landingLagFrames);
      expect(landsOnFrame(id, findMove(id).totalFrames - 1)).toBe(FIGHTER.landingLagFrames);
    },
  );

  it.each(PINNED)(
    '$id: landing between the windows costs its own landing lag',
    ({ id, landingLag, before, after }) => {
      expect(landsOnFrame(id, before)).toBe(landingLag);
      expect(landsOnFrame(id, after - 1)).toBe(landingLag);
    },
  );

  it.each(PINNED)('$id: the windows never cover a hitbox', ({ id, before, after }) => {
    for (const hitbox of findMove(id).hitboxes) {
      expect(hitbox.from).toBeGreaterThanOrEqual(before);
      expect(hitbox.to).toBeLessThanOrEqual(after);
    }
  });

  it('keeps nair the safest and dair the most punishable aerial', () => {
    const lags = PINNED.map((aerial) => aerial.landingLag);
    expect(findMove('neutralAir').landingLag).toBe(Math.min(...lags));
    expect(findMove('downAir').landingLag).toBe(Math.max(...lags));
    expect(FIGHTER.landingLagFrames).toBeLessThan(Math.min(...lags));
  });

  it('auto-cancels a nair started at the end of a real short hop', () => {
    const nair = findMove(CAPSULE.moves.neutralAir ?? '');
    let state = withFighter(settled(), 0, { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } });
    state = step(state, [inputOf({ shortHop: true })]);
    while (fighter(state, 0).grounded) state = step(state, [NONE]);
    // Fall until two frames before touching down, then start the nair.
    while (!fighter(run(state, 2, [NONE]), 0).grounded) state = step(state, [NONE]);
    state = step(state, [inputOf({ attack: true })]);
    expect(fighter(state, 0).moveId).toBe(nair.id);
    while (!fighter(state, 0).grounded) state = step(state, [NONE]);
    expect(fighter(state, 0)).toMatchObject({
      action: 'landing',
      landingLagFrames: FIGHTER.landingLagFrames,
    });
  });

  it('leaves recovery moves without auto-cancel: they land with their own lag', () => {
    expect(findMove('springJack').autoCancel).toBeUndefined();
    expect(findMove('thruster').autoCancel).toBeUndefined();
  });

  describe('validation', () => {
    const NAIR = findMove('neutralAir');
    const withWindow = (
      autoCancel: NonNullable<MoveDef['autoCancel']>,
      move: MoveDef = NAIR,
    ): MoveDef => ({ ...move, autoCancel });

    it('accepts the windows of every aerial', () => {
      for (const { id } of PINNED) expect(() => validateMove(findMove(id))).not.toThrow();
    });

    it('rejects a window on a move without landing lag', () => {
      const jab = findMove('jab');
      expect(() => validateMove(withWindow({ before: 0, after: jab.totalFrames }, jab))).toThrow(
        /autoCancel/,
      );
    });

    it('rejects windows that cover a hitbox or leave the move', () => {
      expect(() => validateMove(withWindow({ before: 5, after: 30 }))).toThrow(/autoCancel/);
      expect(() => validateMove(withWindow({ before: 4, after: 20 }))).toThrow(/autoCancel/);
      expect(() => validateMove(withWindow({ before: 4, after: 40 }))).toThrow(/autoCancel/);
      expect(() => validateMove(withWindow({ before: -1, after: 30 }))).toThrow(/autoCancel/);
    });
  });
});
