import { describe, expect, it } from 'vitest';
import { findMove } from './move-data';
import { PRESS_SLOTS } from './move-slots';
import { RIVET, VELA } from './registry';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, SpawnedObject } from './types';

const NONE = inputOf({});
const SIDE_SPECIAL = inputOf({ x: 1, special: true });

/** `p1` at the centre facing right and `p2` `gap` in front of it, settled on Battlefield. */
const faceOff = (p1: string, p2: string, gap: number): MatchState => {
  let state = run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: p1 }, { characterId: p2 }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );
  state = withFighter(state, 0, { position: { x: 0, y: 0 }, facing: 1, grounded: true });
  return withFighter(state, 1, { position: { x: gap, y: 0 }, facing: -1, grounded: true });
};

/** P1 presses side special once, then the match plays `frames` more frames. */
const sideSpecial = (state: MatchState, frames: number): MatchState =>
  run(run(state, 1, [SIDE_SPECIAL, NONE]), frames, [NONE, NONE]);

/** P1 presses side special and plays until its new object is out; throws if none comes. */
const firstObject = (state: MatchState): { state: MatchState; object: SpawnedObject } => {
  const fresh = state.nextObjectId;
  let next = run(state, 1, [SIDE_SPECIAL, NONE]);
  for (let i = 0; i < 40; i += 1) {
    const object = next.objects.find((o) => o.owner === 0 && o.id >= fresh);
    if (object) return { state: next, object };
    next = run(next, 1, [NONE, NONE]);
  }
  throw new Error('Nothing was spawned');
};

/** P2 standing on `x`, as if it had walked there. */
const moveTarget = (state: MatchState, x: number): MatchState =>
  withFighter(state, 1, { position: { x, y: 0 }, velocity: { x: 0, y: 0 }, grounded: true });

describe('side specials (#49)', () => {
  it.each([RIVET, VELA])('completes $name with a move in every slot', (character) => {
    expect(PRESS_SLOTS.filter((slot) => character.moves[slot] === undefined)).toEqual([]);
  });

  describe("Rivet's wrench toss", () => {
    const FAR = 3;

    it('throws a wrench that hits beyond his reach', () => {
      // Out of reach of the jab and the lunging haymaker alike.
      const after = sideSpecial(faceOff(RIVET.id, VELA.id, FAR), 40);
      expect(fighter(after, 1).damage).toBeGreaterThan(0);
      expect(fighter(after, 1).lastHitBy).toBe(0);
      expect(fighter(after, 0).position.x).toBeCloseTo(0, 1);
    });

    it('flies out, turns, and comes back to his hand', () => {
      const { state, object } = firstObject(faceOff(RIVET.id, VELA.id, -6));
      expect(object.behavior.kind).toBe('return');
      let next = state;
      let furthest = object.position.x;
      let frames = 0;
      while (next.objects.length > 0 && frames < 120) {
        next = run(next, 1, [NONE, NONE]);
        furthest = Math.max(furthest, next.objects[0]?.position.x ?? furthest);
        frames += 1;
      }
      // Caught well before its lifetime ran out, after flying a good way out.
      expect(next.objects).toEqual([]);
      expect(frames).toBeLessThan(object.lifetime - 5);
      expect(furthest).toBeGreaterThan(FAR);
      expect(fighter(next, 0).damage).toBe(0);
    });

    it('hits on the way back, too', () => {
      // Nobody in front as it flies out; Vela steps behind it as it turns.
      const { state } = firstObject(faceOff(RIVET.id, VELA.id, -6));
      let next = run(state, 24, [NONE, NONE]);
      const wrench = next.objects[0];
      if (!wrench) throw new Error('The wrench is gone');
      next = moveTarget(next, wrench.position.x - 1);
      next = run(next, 20, [NONE, NONE]);
      expect(fighter(next, 1).damage).toBeGreaterThan(0);
    });
  });

  describe("Vela's stasis mine", () => {
    it('lays a mine in front of her that stays where it is', () => {
      const { state, object } = firstObject(faceOff(VELA.id, RIVET.id, -6));
      expect(object.behavior.kind).toBe('trap');
      expect(object.position.x).toBeGreaterThan(0.5);
      const later = run(state, 60, [NONE, NONE]);
      expect(later.objects[0]?.position).toEqual(object.position);
    });

    it('is harmless until armed, then pops a fighter that steps on it straight up', () => {
      const { state, object } = firstObject(faceOff(VELA.id, RIVET.id, -6));
      if (object.behavior.kind !== 'trap') throw new Error('A mine is a trap');
      // Rivet walks onto it at once, and off again: nothing happens.
      let next = moveTarget(state, object.position.x);
      next = run(next, 2, [NONE, NONE]);
      expect(fighter(next, 1).damage).toBe(0);
      next = moveTarget(next, -6);
      // Once armed, the next step on it sets it off.
      next = run(next, object.behavior.armFrames, [NONE, NONE]);
      expect(next.objects).toHaveLength(1);
      next = moveTarget(next, object.position.x);
      next = run(next, 1, [NONE, NONE]);
      expect(fighter(next, 1).damage).toBeGreaterThan(0);
      expect(next.objects).toEqual([]);
      // Launched once the hitlag is over.
      while (fighter(next, 1).hitlagFrames > 0) next = run(next, 1, [NONE, NONE]);
      const rivet = fighter(next, 1);
      // A pop-up for a juggle, not a sideways kill.
      expect(rivet.velocity.y).toBeGreaterThan(Math.abs(rivet.velocity.x) * 3);
    });

    it('never goes off under Vela herself', () => {
      const { state, object } = firstObject(faceOff(VELA.id, RIVET.id, -6));
      let next = run(state, 60, [NONE, NONE]);
      next = withFighter(next, 0, { position: { x: object.position.x, y: 0 } });
      next = run(next, 5, [NONE, NONE]);
      expect(next.objects).toHaveLength(1);
      expect(fighter(next, 0).damage).toBe(0);
    });

    it('allows one mine at a time: a new one replaces the old', () => {
      const move = findMove(VELA.moves.sideSpecial ?? '');
      const first = firstObject(faceOff(VELA.id, RIVET.id, -6));
      // Walk off, then lay another.
      let next = run(first.state, move.totalFrames, [NONE, NONE]);
      next = withFighter(next, 0, { position: { x: -3, y: 0 }, grounded: true });
      const second = firstObject(next);
      expect(second.state.objects).toHaveLength(1);
      expect(second.object.id).not.toBe(first.object.id);
      expect(second.object.position.x).toBeLessThan(first.object.position.x);
    });

    it('hangs where she laid it in the air, to guard a ledge', () => {
      const air = withFighter(faceOff(VELA.id, RIVET.id, -6), 0, {
        position: { x: 0, y: 3 },
        velocity: { x: 0, y: 0 },
        grounded: false,
        action: 'airborne',
      });
      const { state, object } = firstObject(air);
      expect(object.position.y).toBeGreaterThan(1.5);
      expect(run(state, 60, [NONE, NONE]).objects[0]?.position).toEqual(object.position);
    });

    it('counts mines per fighter: two Velas keep one each', () => {
      let state = faceOff(VELA.id, VELA.id, -3);
      state = withFighter(state, 1, { facing: -1 });
      state = run(state, 1, [SIDE_SPECIAL, inputOf({ x: -1, special: true })]);
      state = run(state, 30, [NONE, NONE]);
      expect(state.objects.map((o) => o.owner).sort()).toEqual([0, 1]);
    });

    it('fades after a while if nobody steps on it', () => {
      const { state, object } = firstObject(faceOff(VELA.id, RIVET.id, -6));
      expect(run(state, object.lifetime, [NONE, NONE]).objects).toEqual([]);
    });
  });
});
