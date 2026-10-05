import { describe, expect, it } from 'vitest';
import { applyHit, hitstunOf, knockback, launchSpeed } from './combat';
import { CROUCH, KNOCKBACK } from './config';
import type { HitDef } from './moves';
import { poseName } from './poses';
import { CAPSULE } from './registry';
import { createMatch, step } from './simulation';
import { FINAL_DESTINATION } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

const NONE = inputOf({});
const DOWN = inputOf({ y: -1 });
const JAB = inputOf({ attack: true });

/** Two capsules facing each other at the centre of Final Destination, P2 `gap` in front of P1. */
const faceOff = (damage: number, p2Input: PlayerInput, gap = 0.9): MatchState => {
  let state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
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
  state = withFighter(state, 1, {
    position: { x: gap, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: -1,
    grounded: true,
    action: 'idle',
    damage,
  });
  // P2 settles into what it holds: a crouch, or standing.
  return run(state, 10, [NONE, p2Input]);
};

/** P1 attacks with `attack` while P2 holds `p2Input`; the state on the frame of the first hit. */
const hitWith = (state: MatchState, attack: PlayerInput, p2Input: PlayerInput): MatchState => {
  let next = step(state, [attack, p2Input]);
  for (let i = 0; i < 60 && !next.events.some((e) => e.type === 'hit'); i += 1) {
    next = step(next, [NONE, p2Input]);
  }
  return next;
};

const speedOf = ({ x, y }: { x: number; y: number }): number => Math.hypot(x, y);

const bare = (baseKnockback: number): HitDef => ({
  damage: 5,
  angle: 45,
  baseKnockback,
  knockbackGrowth: 0,
});

describe('crouching (#156)', () => {
  it('crouches while standing with the stick held down', () => {
    expect(poseName(fighter(faceOff(0, DOWN), 1))).toBe('crouch');
    expect(poseName(fighter(faceOff(0, NONE), 1))).toBe('idle');
  });
});

describe('crouch cancel (#156)', () => {
  it(`takes ${CROUCH.knockbackScale.toFixed(2)} of the knockback crouched`, () => {
    const standing = fighter(faceOff(0, NONE), 1);
    const crouched = fighter(faceOff(0, DOWN), 1);
    const hit = bare(150);
    const units = knockback(hit, hit.damage, CAPSULE.stats.weight);
    expect(speedOf(applyHit(standing, hit, 1, 0, { x: 0, y: 0 }).target.knockback)).toBeCloseTo(
      launchSpeed(units),
      9,
    );
    const cancelled = applyHit(crouched, hit, 1, 0, { x: 0, y: 0 }).target;
    expect(speedOf(cancelled.knockback)).toBeCloseTo(launchSpeed(units * CROUCH.knockbackScale), 9);
    expect(cancelled.hitstunFrames).toBe(hitstunOf(units * CROUCH.knockbackScale));
  });

  it('stays on the ground for a hit it cancels below the tumble threshold, sliding back', () => {
    const crouched = fighter(faceOff(0, DOWN), 1);
    const units = KNOCKBACK.tumbleFrom * CROUCH.knockbackScale;
    const { target } = applyHit(crouched, bare(KNOCKBACK.tumbleFrom), 1, 0, { x: 0, y: 0 });
    expect(units).toBeLessThan(KNOCKBACK.tumbleFrom);
    expect(target).toMatchObject({ grounded: true, tumbling: false, action: 'hitstun' });
    expect(target.knockback.y).toBe(0);
    expect(target.knockback.x).toBeGreaterThan(0);
  });

  it('stays on the ground through a crouch-cancelled jab, its hitstun short', () => {
    let state = hitWith(faceOff(0, DOWN), JAB, DOWN);
    const hitstun = fighter(state, 1).hitstunFrames;
    expect(hitstun).toBeLessThan(hitstunOf(KNOCKBACK.tumbleFrom / 4));
    while (fighter(state, 1).action === 'hitstun' || fighter(state, 1).hitlagFrames > 0) {
      state = step(state, [NONE, DOWN]);
      expect(fighter(state, 1)).toMatchObject({ grounded: true });
      expect(fighter(state, 1).position.y).toBe(0);
    }
    expect(fighter(state, 1).action).toBe('idle');
  });

  it('answers a jab with a down tilt out of the crouch, sooner than standing could', () => {
    // P2 keeps pressing attack with the stick down: a down tilt as soon as it can act.
    const DOWN_TILT = inputOf({ y: -1, attack: true });
    /** Frames from the jab until P2's down tilt hits P1, holding `p2Input` before the jab. */
    const answer = (p2Input: PlayerInput): number => {
      let state = hitWith(faceOff(0, p2Input), JAB, p2Input);
      for (let frame = 1; frame <= 60; frame += 1) {
        state = step(state, [NONE, frame % 2 === 0 ? DOWN_TILT : DOWN]);
        if (state.events.some((e) => e.type === 'hit' && e.attacker === 1)) return frame;
      }
      return Infinity;
    };
    const crouched = answer(DOWN);
    expect(crouched).toBeLessThan(Infinity);
    expect(crouched).toBeLessThan(answer(NONE));
  });

  it('slides away from a hit that sends it behind the attacker', () => {
    const crouched = fighter(faceOff(0, DOWN), 1);
    const back: HitDef = { ...bare(40), angle: 155 };
    // P2 stands right of P1, struck by a hit P1 swings behind it while facing left.
    expect(applyHit(crouched, back, -1, 0, { x: 0, y: 0 }).target.knockback.x).toBeGreaterThan(0);
  });

  it('takes the slide as it is, whatever the stick holds on the last frame of hitlag', () => {
    const slide = (stick: PlayerInput) => {
      let state = hitWith(faceOff(0, DOWN), JAB, DOWN);
      while (fighter(state, 1).hitlagFrames > 0) state = step(state, [NONE, stick]);
      return fighter(state, 1).knockback;
    };
    // Held down, a crouch would turn a sideways launch by the full DI angle.
    expect(slide(DOWN)).toEqual(slide(NONE));
  });

  it('crouches again after the hitstun and cancels the next hit too', () => {
    let state = hitWith(faceOff(0, DOWN), JAB, DOWN);
    while (fighter(state, 1).action === 'hitstun' || fighter(state, 1).hitlagFrames > 0) {
      state = step(state, [NONE, DOWN]);
    }
    expect(poseName(fighter(state, 1))).toBe('crouch');
    // Straight sideways, so all of it is the slide.
    const hit: HitDef = { ...bare(60), angle: 0 };
    const units = knockback(hit, fighter(state, 1).damage + hit.damage, CAPSULE.stats.weight);
    const { target } = applyHit(fighter(state, 1), hit, 1, 0, { x: 0, y: 0 });
    expect(speedOf(target.knockback)).toBeCloseTo(launchSpeed(units * CROUCH.knockbackScale), 9);
  });

  it('still launches with a strong hit, only less far', () => {
    const SMASH = inputOf({ x: 1, attack: true });
    const standing = fighter(hitWith(faceOff(100, NONE), SMASH, NONE), 1);
    const crouched = fighter(hitWith(faceOff(100, DOWN), SMASH, DOWN), 1);
    expect(crouched).toMatchObject({ grounded: false, tumbling: true });
    expect(speedOf(crouched.knockback)).toBeCloseTo(
      speedOf(standing.knockback) * CROUCH.knockbackScale,
      9,
    );
  });

  it('only cancels on the ground: holding down in the air takes the full launch', () => {
    const crouched = fighter(faceOff(0, DOWN), 1);
    const inAir = { ...crouched, grounded: false, action: 'airborne' as const };
    const hit = bare(60);
    const units = knockback(hit, hit.damage, CAPSULE.stats.weight);
    const { target } = applyHit(inAir, hit, 1, 0, { x: 0, y: 0 });
    expect(speedOf(target.knockback)).toBeCloseTo(launchSpeed(units), 9);
  });
});
