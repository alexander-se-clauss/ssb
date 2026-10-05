import { describe, expect, it } from 'vitest';
import { applyHit, hitstunOf, knockback, launchSpeed } from './combat';
import { KNOCKBACK, STALE } from './config';
import { findMove } from './move-data';
import type { HitDef } from './moves';
import { CAPSULE, RIVET, VELA } from './registry';
import { createMatch, step } from './simulation';
import { FINAL_DESTINATION } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

const NONE = inputOf({});

/** P1 (a capsule) at the centre of Final Destination facing right, `target` at `x` with `damage`. */
const faceOff = (target: string, x: number, damage: number): MatchState => {
  let state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [{ characterId: CAPSULE.id }, { characterId: target }],
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
  return withFighter(state, 1, {
    position: { x, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: -1,
    grounded: true,
    action: 'idle',
    damage,
  });
};

/** P1 presses attack with the stick at `input`; the state on the frame it first hits. */
const firstHit = (state: MatchState, input: PlayerInput): MatchState => {
  let next = step(state, [{ ...input, attack: true }, NONE]);
  for (let frame = 0; frame < 60; frame += 1) {
    if (next.events.some((event) => event.type === 'hit')) return next;
    next = step(next, [NONE, NONE]);
  }
  throw new Error('Never hit');
};

/** Whether P2 leaves through the side or the top of the blast zone, doing nothing. */
const kos = (state: MatchState): boolean => {
  let next = state;
  for (let frame = 0; frame < 400; frame += 1) {
    const before = fighter(next, 1).position;
    next = step(next, [NONE, NONE]);
    if (fighter(next, 1).falls > 0) return before.y > state.stage.blastZone.bottom + 1;
  }
  return false;
};

const SMASH = inputOf({ x: 1 });
const hitBy = (target: string, damage: number, input: PlayerInput = SMASH, x = 0.9) =>
  firstHit(faceOff(target, x, damage), input);

/** A bare hit for the formula table. */
const hit = (damage: number, baseKnockback: number, knockbackGrowth: number): HitDef => ({
  damage,
  angle: 45,
  baseKnockback,
  knockbackGrowth,
});

describe('Melee knockback formula (#153)', () => {
  it.each([
    // [percent after the hit, damage, weight, base, growth] => knockback, hitstun
    [0, 10, 100, 0, 100, 18, 7],
    [100, 10, 100, 0, 100, 102, 40],
    [100, 10, 75, 0, 100, 114, 45],
    [50, 12, 100, 30, 50, 63.5, 25],
    [0, 3, 100, 20, 0, 20, 8],
    [150, 16, 109, 25, 90, 203.975, 81],
  ] as const)(
    'gives %i%% after a %i%% hit on weight %i with base %i and growth %i a knockback of %f',
    (percent, damage, weight, base, growth, expected, hitstun) => {
      const units = knockback(hit(damage, base, growth), percent, weight);
      expect(units).toBeCloseTo(expected, 2);
      expect(hitstunOf(units)).toBe(hitstun);
    },
  );

  it('grows with percent and damage, and shrinks with weight', () => {
    const smash = hit(16, 25, 95);
    expect(knockback(smash, 120, 100)).toBeGreaterThan(knockback(smash, 60, 100));
    expect(knockback(hit(20, 25, 95), 120, 100)).toBeGreaterThan(knockback(smash, 120, 100));
    expect(knockback(smash, 120, 120)).toBeLessThan(knockback(smash, 120, 100));
  });

  it('launches at a speed proportional to the knockback, in stage units per frame', () => {
    expect(launchSpeed(100)).toBeCloseTo(100 * KNOCKBACK.speedPerUnit, 9);
    const state = hitBy(CAPSULE.id, 80);
    const f = fighter(state, 1);
    const smash = findMove('forwardSmash').hitboxes[0];
    expect(smash).toBeDefined();
    if (!smash) return;
    // A fresh smash (#157) deals a little more than its listed damage.
    const units = knockback(
      { ...smash, damage: smash.damage * STALE.freshBonus },
      f.damage,
      CAPSULE.stats.weight,
    );
    expect(Math.hypot(f.velocity.x, f.velocity.y)).toBeCloseTo(launchSpeed(units), 9);
    expect(f.hitstunFrames).toBe(hitstunOf(units));
  });

  it('lets the launch decay along its direction while gravity pulls on its own', () => {
    // A straight sideways launch high in the air: no ground, no blast zone, no drift.
    const speed = launchSpeed(90);
    const state = withFighter(faceOff(CAPSULE.id, 5, 0), 1, {
      position: { x: 0, y: 8 },
      grounded: false,
      action: 'hitstun',
      actionFrame: 0,
      hitstunFrames: 60,
      velocity: { x: speed, y: 0 },
      knockback: { x: speed, y: 0 },
    });
    const frames = 10;
    const after = fighter(run(state, frames, [NONE, NONE]), 1);
    expect(after.knockback.x).toBeCloseTo(speed - frames * KNOCKBACK.decayPerFrame, 9);
    expect(after.knockback.y).toBe(0);
    expect(after.velocity.y).toBeCloseTo(-frames * CAPSULE.stats.gravity, 9);
    expect(after.velocity.x).toBeCloseTo(after.knockback.x, 9);
  });

  it('stops the launch once it has decayed, never reversing it', () => {
    const state = hitBy(CAPSULE.id, 0, inputOf({ y: -0.5 }));
    const later = fighter(run(state, 120, [NONE, NONE]), 1);
    expect(later.knockback).toEqual({ x: 0, y: 0 });
  });
});

describe('a launch and a block (#153)', () => {
  it('drops what is left of a launch when a block takes a hit', () => {
    const rivetFaceOff = withFighter(faceOff(RIVET.id, 0.9, 0), 1, {
      action: 'attack',
      moveId: 'ironGuard',
      actionFrame: (findMove('ironGuard').guard?.from ?? 0) + 1,
      velocity: { x: 0.1, y: 0 },
      knockback: { x: 0.1, y: 0 },
    });
    const blocked = applyHit(fighter(rivetFaceOff, 1), hit(5, 20, 50), 1, 0, { x: 0, y: 0 });
    expect(blocked.guard).toBe('blocked');
    expect(blocked.target.knockback).toEqual({ x: 0, y: 0 });
  });
});

describe('tumble and flinch (#153)', () => {
  it(`tumbles from ${KNOCKBACK.tumbleFrom} knockback on, and only flinches below it`, () => {
    const weak = applyHit(fighter(faceOff(CAPSULE.id, 0.9, 0), 1), hit(5, 40, 0), 1, 0, {
      x: 0,
      y: 0,
    });
    expect(weak.target.tumbling).toBe(false);
    const strong = applyHit(fighter(faceOff(CAPSULE.id, 0.9, 0), 1), hit(5, 80, 0), 1, 0, {
      x: 0,
      y: 0,
    });
    expect(strong.target.tumbling).toBe(true);
    expect(strong.target.hitstunFrames).toBe(hitstunOf(80));
  });

  it('can act right after the hitstun of a flinch', () => {
    let state = hitBy(CAPSULE.id, 0, inputOf({ x: 0.5 }));
    expect(fighter(state, 1).tumbling).toBe(false);
    while (fighter(state, 1).action === 'hitstun' || fighter(state, 1).hitlagFrames > 0) {
      state = step(state, [NONE, NONE]);
    }
    expect(['idle', 'airborne']).toContain(fighter(state, 1).action);
  });

  it('keeps tumbling after the hitstun until it acts, and stops on acting', () => {
    let state = hitBy(CAPSULE.id, 100);
    expect(fighter(state, 1).tumbling).toBe(true);
    while (fighter(state, 1).action === 'hitstun' || fighter(state, 1).hitlagFrames > 0) {
      state = step(state, [NONE, NONE]);
    }
    expect(fighter(state, 1)).toMatchObject({ action: 'airborne', grounded: false });
    expect(fighter(state, 1).tumbling).toBe(true);
    // Acting out of the tumble: an air jump.
    state = step(state, [NONE, inputOf({ jump: true })]);
    expect(fighter(state, 1).tumbling).toBe(false);
  });

  it('stops tumbling on landing', () => {
    let state = hitBy(CAPSULE.id, 100);
    for (let i = 0; i < 400 && !fighter(state, 1).grounded; i += 1) {
      state = step(state, [NONE, inputOf({ x: -1 })]);
    }
    expect(fighter(state, 1).grounded).toBe(true);
    expect(fighter(state, 1).tumbling).toBe(false);
  });
});

describe('weight and gravity in a launch (#153)', () => {
  it('launches a lighter fighter further with the same hit', () => {
    const smash = findMove('forwardSmash').hitboxes[0];
    if (!smash) throw new Error('No smash hitbox');
    expect(VELA.stats.weight).toBeLessThan(CAPSULE.stats.weight);
    expect(knockback(smash, 100, VELA.stats.weight)).toBeGreaterThan(
      knockback(smash, 100, CAPSULE.stats.weight),
    );
  });

  it('brings a fast faller down from the same up tilt sooner, so it leaves a juggle earlier', () => {
    const airtime = (target: string) => {
      let state = hitBy(target, 60, inputOf({ y: 0.5 }), 0.6);
      let frames = 0;
      while (!fighter(state, 1).grounded && frames < 300) {
        state = step(state, [NONE, NONE]);
        frames += 1;
      }
      return frames;
    };
    expect(RIVET.stats.weight).toBe(CAPSULE.stats.weight);
    expect(airtime(RIVET.id)).toBeLessThan(airtime(CAPSULE.id));
    expect(airtime(VELA.id)).toBeGreaterThan(airtime(CAPSULE.id));
  });
});

describe('KO windows per fighter (#153, re-checking #42)', () => {
  it.each([
    // The capsule's forward smash from the centre of Final Destination.
    [CAPSULE.id, 95, 125],
    [RIVET.id, 100, 130],
    [VELA.id, 80, 110],
  ] as const)('KOs %s with a forward smash between %i and %i percent', (id, safe, kills) => {
    expect(kos(hitBy(id, safe))).toBe(false);
    expect(kos(hitBy(id, kills))).toBe(true);
  });
});
