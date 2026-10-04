import { describe, expect, it } from 'vitest';
import { activeGuard, applyHit } from './combat';
import { findMove } from './move-data';
import { validateMove, type MoveDef } from './moves';
import { POSES } from './pose-data';
import { CAPSULE, RIVET } from './registry';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { FighterState, GameEvent, MatchState, PlayerInput } from './types';

type HitEvent = Extract<GameEvent, { type: 'hit' }>;

const GUARD_MOVE = findMove('ironGuard');
const GUARD = GUARD_MOVE.guard;
if (!GUARD) throw new Error("Rivet's down special has a guard");
const JAB_DAMAGE = findMove('jab').hitboxes[0]?.damage ?? 0;

const DOWN_SPECIAL = inputOf({ y: -1, special: true });
const HOLD = inputOf({ special: true });
const NONE = inputOf({});

/** Rivet (P1) and a capsule (P2) settled on Battlefield. */
const match = (): MatchState =>
  run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: RIVET.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );

/**
 * Rivet at the centre facing `rivetFacing`, the capsule 0.8 to its right facing it, with Rivet's
 * guard up (played to the guard's first frame, special still held).
 */
const guarding = (rivetFacing: 1 | -1 = 1): MatchState => {
  let state = withFighter(match(), 0, {
    position: { x: 0, y: 0 },
    facing: rivetFacing,
    grounded: true,
  });
  state = withFighter(state, 1, { position: { x: 0.8, y: 0 }, facing: -1, grounded: true });
  state = run(state, 1, [DOWN_SPECIAL]);
  state = run(state, GUARD.from, [HOLD]);
  expect(activeGuard(fighter(state, 0))).toBeDefined();
  return state;
};

/** Steps with Rivet holding special and the capsule pressing `attack` once, until a hit lands. */
const attackGuard = (
  state: MatchState,
  attack: PlayerInput,
): { event: HitEvent; after: MatchState } => {
  let next = run(state, 1, [HOLD, attack]);
  for (let i = 0; i < 60; i += 1) {
    const event = next.events.find((e): e is HitEvent => e.type === 'hit');
    if (event) return { event, after: next };
    next = run(next, 1, [HOLD, NONE]);
  }
  throw new Error('The attack never hit');
};

const JAB = inputOf({ attack: true });
const FORWARD_SMASH = inputOf({ x: -1, attack: true });

describe("Rivet's block (#50)", () => {
  it('is his down special, a guard move with no hitboxes', () => {
    expect(RIVET.moves.downSpecial).toBe('ironGuard');
    expect(GUARD_MOVE.hitboxes).toEqual([]);
    const started = fighter(run(match(), 1, [DOWN_SPECIAL]), 0);
    expect(started.action).toBe('attack');
    expect(started.moveId).toBe('ironGuard');
  });

  it('only guards on its guard frames', () => {
    let state = run(match(), 1, [DOWN_SPECIAL]);
    expect(activeGuard(fighter(state, 0))).toBeUndefined();
    state = run(state, GUARD.from, [NONE]);
    expect(activeGuard(fighter(state, 0))).toBeDefined();
    state = run(state, GUARD.to - GUARD.from, [NONE]);
    expect(fighter(state, 0).actionFrame).toBe(GUARD.to);
    expect(activeGuard(fighter(state, 0))).toBeUndefined();
  });

  it('holds the guard up while special stays held, and lets go after release', () => {
    let state = run(match(), 1, [DOWN_SPECIAL]);
    state = run(state, 120, [HOLD]);
    expect(fighter(state, 0).moveId).toBe('ironGuard');
    expect(fighter(state, 0).actionFrame).toBe(GUARD.hold);
    expect(activeGuard(fighter(state, 0))).toBeDefined();
    state = run(state, GUARD_MOVE.totalFrames, [NONE]);
    expect(fighter(state, 0).action).toBe('idle');
  });

  it('cannot be started in the air (#10: block on the ground only)', () => {
    const air = withFighter(match(), 0, {
      position: { x: 0, y: 4 },
      velocity: { x: 0, y: 0 },
      grounded: false,
      action: 'airborne',
    });
    const next = fighter(run(air, 1, [DOWN_SPECIAL]), 0);
    expect(next.action).toBe('airborne');
    expect(next.moveId).toBeNull();
  });

  it('takes a blocked hit with less damage and no launch', () => {
    const { event, after } = attackGuard(guarding(), JAB);
    const rivet = fighter(after, 0);
    expect(event.guard).toBe('blocked');
    expect(rivet.damage).toBeCloseTo(JAB_DAMAGE * GUARD.damageScale);
    expect(event.damage).toBeCloseTo(JAB_DAMAGE * GUARD.damageScale);
    expect(fighter(after, 1).damageDealt).toBeCloseTo(JAB_DAMAGE * GUARD.damageScale);
    // Still guarding, on the ground, not in hitstun.
    expect(rivet.action).toBe('attack');
    expect(rivet.moveId).toBe('ironGuard');
    expect(rivet.grounded).toBe(true);
    expect(rivet.lastHitBy).toBe(1);
  });

  it('pushes the blocker back, away from the hit', () => {
    const before = fighter(guarding(), 0).position.x;
    const { after } = attackGuard(guarding(), JAB);
    expect(fighter(after, 0).velocity.x).toBeLessThan(0);
    const later = run(after, 30, [HOLD, NONE]);
    expect(fighter(later, 0).position.x).toBeLessThan(before - 0.05);
    expect(fighter(later, 0).grounded).toBe(true);
  });

  it('pushes back by the hit alone, not the percent, so a high-percent guard stays on stage', () => {
    const tilt = findMove('forwardTilt').hitboxes[0];
    if (!tilt) throw new Error('The forward tilt has a hitbox');
    const rivet = fighter(guarding(), 0);
    const fresh = applyHit(rivet, tilt, -1, 1, { x: 0.8, y: 0 });
    const worn = applyHit({ ...rivet, damage: 120 }, tilt, -1, 1, { x: 0.8, y: 0 });
    expect(worn.guard).toBe('blocked');
    expect(worn.target.velocity.x).toBeCloseTo(fresh.target.velocity.x);
    const pushed = run(withFighter(guarding(), 0, worn.target), 60, [HOLD, NONE]);
    expect(fighter(pushed, 0).grounded).toBe(true);
    expect(fighter(pushed, 0).moveId).toBe('ironGuard');
    expect(fighter(pushed, 0).position.x).toBeGreaterThan(-2);
  });

  it('blocks a projectile in a match, crediting its owner the reduced damage', () => {
    const shot = { damage: 6, angle: 30, baseKnockback: 0.2, knockbackGrowth: 0.002 };
    const state = guarding();
    const incoming: MatchState = {
      ...state,
      objects: [
        {
          id: state.nextObjectId,
          owner: 1,
          moveId: 'pulseShot',
          position: { x: 0.9, y: 0.8 },
          velocity: { x: -0.2, y: 0 },
          launchVelocity: { x: -0.2, y: 0 },
          facing: -1,
          age: 0,
          lifetime: 60,
          radius: 0.3,
          hit: shot,
          behavior: { kind: 'straight' },
        },
      ],
      nextObjectId: state.nextObjectId + 1,
    };
    const { event, after } = attackGuard(incoming, NONE);
    expect(event.guard).toBe('blocked');
    expect(event.damage).toBeCloseTo(shot.damage * GUARD.damageScale);
    expect(fighter(after, 1).damageDealt).toBeCloseTo(shot.damage * GUARD.damageScale);
    expect(fighter(after, 0).moveId).toBe('ironGuard');
    expect(after.objects).toEqual([]);
  });

  it('lets a jump pressed with down special in the air through', () => {
    const air = withFighter(match(), 0, {
      position: { x: 0, y: 4 },
      velocity: { x: 0, y: -0.05 },
      grounded: false,
      action: 'airborne',
    });
    const next = fighter(run(air, 1, [inputOf({ y: -1, special: true, jump: true })]), 0);
    expect(next.velocity.y).toBeGreaterThan(0);
  });

  it('does not guard against a hit from behind (#10: front only)', () => {
    const { event, after } = attackGuard(guarding(-1), JAB);
    expect(event.guard).toBeUndefined();
    expect(fighter(after, 0).damage).toBe(JAB_DAMAGE);
    expect(fighter(after, 0).action).toBe('hitstun');
  });

  it('breaks under a strong hit, which lands in full and stuns for longer', () => {
    const { event, after } = attackGuard(guarding(), FORWARD_SMASH);
    expect(event.damage).toBeGreaterThanOrEqual(GUARD.breakDamage);
    expect(event.guard).toBe('broken');
    const rivet = fighter(after, 0);
    expect(rivet.damage).toBe(event.damage);
    expect(rivet.action).toBe('hitstun');
    // The same hit on a fighter without a guard stuns for `breakStun` frames less.
    const open = applyHit(
      { ...fighter(guarding(), 0), action: 'idle', moveId: null },
      { damage: event.damage, angle: 0, baseKnockback: 0.1, knockbackGrowth: 0 },
      -1,
      1,
      { x: 0.5, y: 1 },
    );
    const broken = applyHit(
      fighter(guarding(), 0),
      { damage: event.damage, angle: 0, baseKnockback: 0.1, knockbackGrowth: 0 },
      -1,
      1,
      { x: 0.5, y: 1 },
    );
    expect(broken.guard).toBe('broken');
    expect(broken.target.hitstunFrames).toBe(open.target.hitstunFrames + GUARD.breakStun);
  });

  it('blocks a projectile flying at its front the same way', () => {
    const rivet: FighterState = fighter(guarding(), 0);
    const shot = { damage: 6, angle: 30, baseKnockback: 0.2, knockbackGrowth: 0.002 };
    const front = applyHit(rivet, shot, -1, 1, { x: 0.6, y: 0.8 });
    expect(front.guard).toBe('blocked');
    expect(front.damage).toBeCloseTo(shot.damage * GUARD.damageScale);
    const back = applyHit(rivet, shot, 1, 1, { x: -0.6, y: 0.8 });
    expect(back.guard).toBeUndefined();
    expect(back.target.action).toBe('hitstun');
  });
});

describe('guard data (#50)', () => {
  const base: MoveDef = {
    kind: 'attack',
    id: 'wall',
    totalFrames: 20,
    hitboxes: [],
    poses: [{ frame: 0, pose: POSES.idle }],
    cancels: [],
  };
  const withGuard = (patch: object): MoveDef => ({
    ...base,
    guard: {
      from: 2,
      to: 12,
      hold: 6,
      damageScale: 0.3,
      pushback: 0.5,
      breakDamage: 15,
      breakStun: 20,
      ...patch,
    },
  });

  it('accepts a guard window with a hold frame inside it', () => {
    expect(() => validateMove(withGuard({}))).not.toThrow();
  });

  it.each([
    ['with an empty window', { from: 5, to: 5 }],
    ['after the move', { to: 21 }],
    ['holding outside its window', { hold: 12 }],
    ['taking more damage than unguarded', { damageScale: 1.5 }],
    ['pulling the blocker in', { pushback: -1 }],
    ['that nothing breaks', { breakDamage: 0 }],
    ['with a broken stun', { breakStun: 2.5 }],
  ])('refuses a guard %s', (_, patch) => {
    expect(() => validateMove(withGuard(patch))).toThrow(/guard/);
  });
});
