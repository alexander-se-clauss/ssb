import { describe, expect, it } from 'vitest';
import { activeCounter, applyHit } from './combat';
import { findMove, validateMoves } from './move-data';
import { moveTiming, validateMove, type MoveDef } from './moves';
import { POSES } from './pose-data';
import { CAPSULE, VELA } from './registry';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { GameEvent, MatchState, PlayerInput } from './types';

type HitEvent = Extract<GameEvent, { type: 'hit' }>;

const COUNTER_MOVE = findMove('riposte');
const COUNTER = COUNTER_MOVE.counter;
if (!COUNTER) throw new Error("Vela's down special is a counter");
const STRIKE = findMove(COUNTER.into);
const JAB_DAMAGE = findMove('jab').hitboxes[0]?.damage ?? 0;

const DOWN_SPECIAL = inputOf({ y: -1, special: true });
const NONE = inputOf({});
const JAB = inputOf({ attack: true });

/** Vela (P1) and a capsule (P2) settled on Battlefield. */
const match = (): MatchState =>
  run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: VELA.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );

/** Vela at the centre facing `facing`, the capsule 0.8 to her right facing her. */
const faceOff = (facing: 1 | -1 = 1): MatchState => {
  const state = withFighter(match(), 0, { position: { x: 0, y: 0 }, facing, grounded: true });
  return withFighter(state, 1, { position: { x: 0.8, y: 0 }, facing: -1, grounded: true });
};

/** Vela starts her counter, then plays `frames` more frames of it. */
const countering = (frames: number, facing: 1 | -1 = 1): MatchState =>
  run(run(faceOff(facing), 1, [DOWN_SPECIAL]), frames, [NONE]);

/** Steps with the capsule pressing `attack` once, until a hit event comes; `undefined` if none. */
const firstHit = (
  state: MatchState,
  attack: PlayerInput,
  limit = 40,
): { event: HitEvent; after: MatchState } | undefined => {
  let next = run(state, 1, [NONE, attack]);
  for (let i = 0; i < limit; i += 1) {
    const event = next.events.find((e): e is HitEvent => e.type === 'hit');
    if (event) return { event, after: next };
    next = run(next, 1, [NONE, NONE]);
  }
  return undefined;
};

/** The jab's frames before its first hitbox: start the jab this many frames before a target frame. */
const JAB_STARTUP = moveTiming(findMove('jab')).startupFrames;

describe("Vela's counter (#51)", () => {
  it('is her down special, with a counterattack of its own', () => {
    expect(VELA.moves.downSpecial).toBe('riposte');
    expect(COUNTER_MOVE.hitboxes).toEqual([]);
    expect(STRIKE.hitboxes.length).toBeGreaterThan(0);
    const started = fighter(run(match(), 1, [DOWN_SPECIAL]), 0);
    expect(started.moveId).toBe('riposte');
  });

  it('is only ready on its window frames', () => {
    expect(activeCounter(fighter(countering(COUNTER.from - 1), 0))).toBeUndefined();
    expect(activeCounter(fighter(countering(COUNTER.from), 0))).toBeDefined();
    expect(activeCounter(fighter(countering(COUNTER.to - 1), 0))).toBeDefined();
    expect(activeCounter(fighter(countering(COUNTER.to), 0))).toBeUndefined();
  });

  it('takes no damage from a hit inside the window and strikes back', () => {
    // The jab lands a frame or so into the window.
    const hit = firstHit(countering(COUNTER.from - JAB_STARTUP + 1), JAB);
    if (!hit) throw new Error('The jab never connected');
    expect(hit.event.guard).toBe('countered');
    expect(hit.event.damage).toBe(0);
    const vela = fighter(hit.after, 0);
    expect(vela.damage).toBe(0);
    expect(vela.moveId).toBe(COUNTER.into);
    expect(fighter(hit.after, 1).damageDealt).toBe(0);
    // The counterattack lands on the capsule.
    const later = run(hit.after, moveTiming(STRIKE).totalFrames, [NONE, NONE]);
    expect(fighter(later, 1).damage).toBeGreaterThan(0);
    expect(fighter(later, 1).lastHitBy).toBe(0);
    expect(fighter(later, 0).damage).toBe(0);
  });

  it('turns round to strike an attacker behind her', () => {
    const state = countering(COUNTER.from, -1);
    const { target } = applyHit(
      fighter(state, 0),
      { damage: 8, angle: 40, baseKnockback: 0.2, knockbackGrowth: 0.004 },
      -1,
      1,
      { x: 0.8, y: 0 },
    );
    expect(target.moveId).toBe(COUNTER.into);
    expect(target.facing).toBe(1);
    expect(target.damage).toBe(0);
  });

  it('cannot be hit by a second attacker on the same frame', () => {
    // Two capsules jab Vela from both sides at once, inside her window.
    let state = run(
      createMatch({
        stageId: BATTLEFIELD.id,
        players: [
          { characterId: VELA.id },
          { characterId: CAPSULE.id },
          { characterId: CAPSULE.id },
        ],
        rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
        countdownFrames: 0,
      }),
      120,
    );
    state = withFighter(state, 0, { position: { x: 0, y: 0 }, facing: 1, grounded: true });
    state = withFighter(state, 1, { position: { x: 0.8, y: 0 }, facing: -1, grounded: true });
    state = withFighter(state, 2, { position: { x: -0.8, y: 0 }, facing: 1, grounded: true });
    state = run(state, 1, [DOWN_SPECIAL, NONE, NONE]);
    state = run(state, COUNTER.from - JAB_STARTUP + 1, [NONE, NONE, NONE]);
    state = run(state, 1, [NONE, JAB, JAB]);
    let countered = 0;
    for (let i = 0; i < 40; i += 1) {
      state = run(state, 1, [NONE, NONE, NONE]);
      countered += state.events.filter((e) => e.type === 'hit' && e.target === 0).length;
    }
    expect(countered).toBeGreaterThan(0);
    expect(fighter(state, 0).damage).toBe(0);
  });

  it('counters a hit in the air, and landing does not cut the counterattack short', () => {
    // Vela just above the stage, the capsule's forward air coming at her.
    let state = withFighter(faceOff(), 0, {
      position: { x: 0, y: 0.6 },
      velocity: { x: 0, y: 0 },
      grounded: false,
      action: 'airborne',
    });
    state = run(state, 1, [DOWN_SPECIAL, NONE]);
    state = run(state, COUNTER.from - JAB_STARTUP + 1, [NONE, NONE]);
    const hit = firstHit(state, JAB);
    if (!hit) throw new Error('The jab never connected');
    expect(hit.event.guard).toBe('countered');
    const later = run(hit.after, moveTiming(STRIKE).totalFrames, [NONE, NONE]);
    expect(fighter(later, 0).grounded).toBe(true);
    expect(fighter(later, 1).damage).toBeGreaterThan(0);
  });

  it('counters a projectile in a match, with no damage and no credit', () => {
    const state = countering(COUNTER.from);
    const shot = { damage: 6, angle: 30, baseKnockback: 0.2, knockbackGrowth: 0.002 };
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
    const hit = firstHit(incoming, NONE);
    if (!hit) throw new Error('The shot never connected');
    expect(hit.event.guard).toBe('countered');
    expect(fighter(hit.after, 0).damage).toBe(0);
    expect(fighter(hit.after, 0).moveId).toBe(COUNTER.into);
    expect(fighter(hit.after, 1).damageDealt).toBe(0);
    expect(hit.after.objects).toEqual([]);
  });

  it('takes a hit before the window in full', () => {
    const early = countering(COUNTER.from - 1);
    const struck = applyHit(
      fighter(early, 0),
      { damage: JAB_DAMAGE, angle: 40, baseKnockback: 0.1, knockbackGrowth: 0.002 },
      -1,
      1,
      { x: 0.8, y: 0 },
    );
    expect(struck.guard).toBeUndefined();
    expect(struck.target.damage).toBe(JAB_DAMAGE);
    expect(struck.target.action).toBe('hitstun');
  });

  it('takes a hit after the window in full: the whiff is punishable', () => {
    const recovering = countering(COUNTER.to);
    const struck = applyHit(
      fighter(recovering, 0),
      { damage: JAB_DAMAGE, angle: 40, baseKnockback: 0.1, knockbackGrowth: 0.002 },
      -1,
      1,
      { x: 0.8, y: 0 },
    );
    expect(struck.guard).toBeUndefined();
    expect(struck.target.action).toBe('hitstun');
  });

  it('leaves her stuck in recovery after a whiff', () => {
    const recovery = COUNTER_MOVE.totalFrames - COUNTER.to;
    expect(recovery).toBeGreaterThanOrEqual(15);
    const whiffed = countering(COUNTER.to);
    expect(fighter(whiffed, 0).moveId).toBe('riposte');
    // A jump pressed now does nothing until the move is over.
    const tried = run(whiffed, 1, [inputOf({ jump: true })]);
    expect(fighter(tried, 0).grounded).toBe(true);
    const done = run(whiffed, recovery, [NONE]);
    expect(fighter(done, 0).action).toBe('idle');
  });

  it('works in the air too (#10)', () => {
    const air = withFighter(match(), 0, {
      position: { x: 0, y: 4 },
      velocity: { x: 0, y: 0 },
      grounded: false,
      action: 'airborne',
    });
    const started = run(air, 1, [DOWN_SPECIAL]);
    expect(fighter(started, 0).moveId).toBe('riposte');
    const ready = run(started, COUNTER.from, [NONE]);
    expect(activeCounter(fighter(ready, 0))).toBeDefined();
  });

  it('counters a projectile the same way', () => {
    const state = countering(COUNTER.from);
    const shot = { damage: 6, angle: 30, baseKnockback: 0.2, knockbackGrowth: 0.002 };
    const result = applyHit(fighter(state, 0), shot, -1, 1, { x: 1.5, y: 0.8 });
    expect(result.guard).toBe('countered');
    expect(result.damage).toBe(0);
    expect(result.target.moveId).toBe(COUNTER.into);
  });
});

describe('counter data (#51)', () => {
  const base: MoveDef = {
    kind: 'attack',
    id: 'mirror',
    totalFrames: 30,
    hitboxes: [],
    poses: [{ frame: 0, pose: POSES.idle }],
    cancels: [],
  };
  const withCounter = (patch: object): MoveDef => ({
    ...base,
    counter: { from: 4, to: 14, into: 'jab', ...patch },
  });

  it('accepts a window within the move', () => {
    expect(() => validateMove(withCounter({}))).not.toThrow();
  });

  it.each([
    ['with an empty window', { from: 6, to: 6 }],
    ['after the move', { to: 31 }],
  ])('refuses a counter %s', (_, patch) => {
    expect(() => validateMove(withCounter(patch))).toThrow(/counter/);
  });

  it('refuses a counter into an unknown move', () => {
    expect(() => validateMoves([withCounter({ into: 'nothing' })])).toThrow(/nothing/);
  });

  it('refuses a move that both guards and counters', () => {
    const both: MoveDef = {
      ...withCounter({}),
      guard: {
        from: 4,
        to: 14,
        damageScale: 0.3,
        pushback: 1,
        breakDamage: 15,
        breakStun: 20,
      },
    };
    expect(() => validateMove(both)).toThrow(/counter/);
  });
});
