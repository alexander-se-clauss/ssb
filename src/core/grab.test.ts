import { describe, expect, it } from 'vitest';
import { DODGE, GRAB } from './config';
import { findMove } from './move-data';
import { CAPSULE, RIVET } from './registry';
import { createMatch, step } from './simulation';
import { BATTLEFIELD, FINAL_DESTINATION } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

const NONE = inputOf({});
/** The grab input (#159). */
const GRAB_PRESS = inputOf({ grab: true });

/** P1 at the centre of Final Destination facing right, P2 (`target`) `gap` in front of it. */
const faceOff = (gap = 0.8, target = CAPSULE.id, players = 2): MatchState => {
  let state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [
        { characterId: CAPSULE.id },
        { characterId: target },
        ...Array.from({ length: players - 2 }, () => ({ characterId: CAPSULE.id })),
      ],
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
  });
  return players > 2
    ? withFighter(state, 2, {
        position: { x: -4, y: 0 },
        velocity: { x: 0, y: 0 },
        facing: 1,
        grounded: true,
        action: 'idle',
      })
    : state;
};

/** P1 grabs and P2 holds `p2`; the state once the grab caught or its move ended. */
const grab = (state: MatchState, p2: PlayerInput = NONE): MatchState => {
  let now = step(state, [GRAB_PRESS, p2]);
  for (let i = 0; i < 60 && fighter(now, 0).action === 'attack'; i += 1) {
    now = step(now, [NONE, p2]);
  }
  return now;
};

const caught = (): MatchState => grab(faceOff());

describe('grabs (#159)', () => {
  it('catches a fighter in front: the holder holds it at arm’s length', () => {
    const state = caught();
    expect(fighter(state, 0)).toMatchObject({ action: 'holding', holding: 1 });
    expect(fighter(state, 1)).toMatchObject({ action: 'grabbed', heldBy: 0, facing: -1 });
    expect(fighter(state, 1).position.x).toBeCloseTo(GRAB.holdDistance, 9);
  });

  it('whiffs with noticeable endlag when nobody is in reach', () => {
    const whiff = findMove('grab');
    let state = step(faceOff(3), [GRAB_PRESS, NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: 'grab' });
    let frames = 0;
    while (fighter(state, 0).action === 'attack' && frames < 100) {
      state = step(state, [NONE, NONE]);
      frames += 1;
    }
    expect(fighter(state, 1).action).toBe('idle');
    expect(frames).toBe(whiff.totalFrames);
    // Most of the move comes after its grab box is gone.
    expect(whiff.totalFrames - (whiff.grab?.to ?? 0)).toBeGreaterThanOrEqual(15);
  });

  it('dash grabs out of a run, reaching further than a standing grab', () => {
    const DASH = findMove('dashGrab');
    expect(DASH.grab?.anchor).toBeDefined();
    let state = withFighter(faceOff(2.2), 0, { action: 'run', velocity: { x: 0.2, y: 0 } });
    state = step(state, [inputOf({ x: 1, grab: true }), NONE]);
    expect(fighter(state, 0).moveId).toBe('dashGrab');
    state = grab(state);
    expect(fighter(state, 0).action).toBe('holding');
    expect(fighter(grab(faceOff(2.2)), 0).action).not.toBe('holding');
  });

  it('pivot grabs out of a run turn, swinging round to grab behind', () => {
    // P1 runs left, away from P2, then turns: the pivot grab catches P2 behind it.
    const state = withFighter(faceOff(0.9), 0, { action: 'runTurn', actionFrame: 1, facing: -1 });
    const pivoted = step(state, [GRAB_PRESS, NONE]);
    expect(fighter(pivoted, 0)).toMatchObject({ moveId: 'pivotGrab', facing: 1 });
    expect(fighter(grab(state), 0).action).toBe('holding');
  });

  it('grabs on a pass-through platform with the stick held down, not dropping through it', () => {
    let state = createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    });
    state = withFighter(state, 0, {
      position: { x: 3, y: 2.2 },
      velocity: { x: 0, y: 0 },
      grounded: true,
      action: 'idle',
    });
    const downGrab = inputOf({ y: -1, grab: true });
    // Pressed together, and with down held first.
    expect(fighter(step(state, [downGrab, NONE]), 0)).toMatchObject({
      moveId: 'grab',
      grounded: true,
    });
    const crouched = step(state, [inputOf({ y: -0.3 }), NONE]);
    expect(fighter(step(crouched, [downGrab, NONE]), 0)).toMatchObject({
      moveId: 'grab',
      grounded: true,
    });
  });

  it('pummels the held fighter for a little damage with attack', () => {
    let state = caught();
    const before = fighter(state, 1).damage;
    state = step(state, [inputOf({ attack: true }), NONE]);
    expect(fighter(state, 0).action).toBe('pummel');
    state = run(state, GRAB.pummel.hitFrame, [NONE, NONE]);
    expect(fighter(state, 1).damage).toBeCloseTo(before + GRAB.pummel.damage, 9);
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: 'hit', attacker: 0, target: 1, launch: 0 }),
    );
    state = run(state, GRAB.pummel.totalFrames, [NONE, NONE]);
    expect(fighter(state, 0).action).toBe('holding');
    expect(fighter(state, 1).action).toBe('grabbed');
  });

  /** Frames until P2 breaks free, holding `p2(frame)`. */
  const holdTime = (state: MatchState, p2: (frame: number) => PlayerInput): number => {
    let now = state;
    for (let frame = 1; frame <= 600; frame += 1) {
      now = step(now, [NONE, p2(frame)]);
      if (fighter(now, 1).action !== 'grabbed') return frame;
    }
    return Infinity;
  };

  it('holds longer at higher percent', () => {
    const low = holdTime(caught(), () => NONE);
    const high = holdTime(grab(withFighter(faceOff(), 1, { damage: 100 })), () => NONE);
    expect(high).toBeGreaterThan(low);
    expect(low).toBe(GRAB.hold.baseFrames);
  });

  it('breaks free sooner when the held fighter mashes buttons and the stick', () => {
    const still = holdTime(caught(), () => NONE);
    const buttons = holdTime(caught(), (frame) => inputOf({ attack: frame % 2 === 0 }));
    const stick = holdTime(caught(), (frame) => inputOf({ x: frame % 2 === 0 ? 1 : 0 }));
    expect(buttons).toBeLessThan(still / 2);
    expect(stick).toBeLessThan(still / 2);
  });

  it('puts both into a short grab release, apart, after which both can act', () => {
    let state = caught();
    while (fighter(state, 1).action === 'grabbed') state = step(state, [NONE, NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'grabRelease', holding: null });
    expect(fighter(state, 1)).toMatchObject({ action: 'grabRelease', heldBy: null });
    expect(fighter(state, 1).position.x - fighter(state, 0).position.x).toBeGreaterThan(
      GRAB.holdDistance,
    );
    state = run(state, GRAB.release.frames, [NONE, NONE]);
    expect(fighter(state, 0).action).toBe('idle');
    expect(fighter(state, 1).action).toBe('idle');
  });

  it('gives a fighter caught with its jumps used up its jumps back, as on landing', () => {
    const state = grab(withFighter(faceOff(), 1, { jumpsRemaining: 0, airDodgeUsed: true }));
    expect(fighter(state, 1)).toMatchObject({
      action: 'grabbed',
      jumpsRemaining: CAPSULE.stats.airJumps + 1,
      airDodgeUsed: false,
    });
  });

  it('beats a dodge in its endlag, not on its invulnerable frames', () => {
    const { invulnerableTo } = DODGE.sidestep;
    // The grab box comes out on its first active frame: line the sidestep up with it.
    const active = findMove('grab').grab?.from ?? 0;
    const dodging = (frame: number) =>
      withFighter(faceOff(), 1, { action: 'sidestepIn', actionFrame: frame - active });
    expect(fighter(grab(dodging(invulnerableTo - 4)), 1).action).not.toBe('grabbed');
    expect(fighter(grab(dodging(invulnerableTo + 1)), 1).action).toBe('grabbed');
  });

  it("beats a block: Rivet's Iron Guard does not stop it", () => {
    const guarding = withFighter(faceOff(0.8, RIVET.id), 1, {
      action: 'attack',
      moveId: 'ironGuard',
      actionFrame: (findMove('ironGuard').guard?.from ?? 0) + 1,
    });
    expect(fighter(grab(guarding, inputOf({ special: true })), 1).action).toBe('grabbed');
  });

  it('lets go when the holder is hit', () => {
    let state = grab(faceOff(0.8, CAPSULE.id, 3));
    expect(fighter(state, 0).action).toBe('holding');
    // P3 walks up behind the holder and jabs it.
    state = withFighter(state, 2, { position: { x: -0.8, y: 0 }, facing: 1 });
    state = step(state, [NONE, NONE, inputOf({ attack: true })]);
    for (let i = 0; i < 20 && fighter(state, 0).action !== 'hitstun'; i += 1) {
      state = step(state, [NONE, NONE, NONE]);
    }
    expect(fighter(state, 0)).toMatchObject({ action: 'hitstun', holding: null });
    expect(fighter(state, 1)).toMatchObject({ heldBy: null });
    expect(fighter(state, 1).action).not.toBe('grabbed');
  });

  it('lets go when the held fighter is hit', () => {
    let state = grab(faceOff(0.8, CAPSULE.id, 3));
    // P3 comes round the front and jabs the held fighter.
    state = withFighter(state, 2, { position: { x: 1.7, y: 0 }, facing: -1 });
    state = step(state, [NONE, NONE, inputOf({ attack: true })]);
    for (let i = 0; i < 20 && fighter(state, 1).action !== 'hitstun'; i += 1) {
      state = step(state, [NONE, NONE, NONE]);
    }
    expect(fighter(state, 1)).toMatchObject({ action: 'hitstun', heldBy: null });
    expect(fighter(state, 0).holding).toBeNull();
    expect(fighter(state, 0).action).not.toMatch(/holding|pummel/);
  });

  it('settles a grab of each other on the same frame for the lower slot', () => {
    const state = grab(faceOff(), GRAB_PRESS);
    expect(fighter(state, 0).action).toBe('holding');
    expect(fighter(state, 1).action).toBe('grabbed');
  });

  describe('at the edge of the stage', () => {
    const EDGE = FINAL_DESTINATION.platforms[0]?.bounds.right ?? 0;
    /** P1 at the edge facing off it, P2 between it and the edge. */
    const atEdge = (): MatchState =>
      withFighter(withFighter(faceOff(), 0, { position: { x: EDGE - 0.3, y: 0 } }), 1, {
        position: { x: EDGE - 0.05, y: 0 },
      });

    it('holds the catch on the stage, not in the air past it', () => {
      const state = grab(atEdge());
      expect(fighter(state, 1).action).toBe('grabbed');
      expect(fighter(state, 1).position.x).toBeLessThanOrEqual(EDGE);
    });

    it('pushes both apart on the stage, so both sit out the whole release', () => {
      let state = grab(atEdge());
      while (fighter(state, 1).action === 'grabbed') state = step(state, [NONE, NONE]);
      for (const slot of [0, 1]) {
        expect(fighter(state, slot).position.x).toBeLessThanOrEqual(EDGE);
      }
      state = run(state, GRAB.release.frames - 1, [NONE, NONE]);
      expect(fighter(state, 0).action).toBe('grabRelease');
      expect(fighter(state, 1).action).toBe('grabRelease');
    });
  });

  it('is not a hit: a catch deals no damage and does not stale the grab', () => {
    const state = caught();
    expect(fighter(state, 1).damage).toBe(0);
    expect(fighter(state, 0).staleMoves).toEqual([]);
  });
});
