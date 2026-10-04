import { describe, expect, it } from 'vitest';
import { knockback } from './combat';
import { FIGHTER } from './config';
import { findMove } from './move-data';
import { PRESS_SLOTS } from './move-slots';
import { CAPSULE, RIVET } from './registry';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { LedgeDef, MatchState } from './types';

const NEUTRAL_SPECIAL = [inputOf({ special: true })];
const UP_SPECIAL = [inputOf({ y: 1, special: true })];

/** Rivet as P1, and a capsule as P2 if `opponent`, settled on Battlefield. */
const match = (opponent = true): MatchState =>
  run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: RIVET.id }, ...(opponent ? [{ characterId: CAPSULE.id }] : [])],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );

/** Rivet at the centre of the main stage facing right, the capsule `gap` in front of it. */
const faceOff = (gap: number): MatchState => {
  let state = withFighter(match(), 0, { position: { x: 0, y: 0 }, facing: 1, grounded: true });
  state = withFighter(state, 1, { position: { x: gap, y: 0 }, facing: -1, grounded: true });
  return run(state, 1);
};

/** Frames until `done` holds, or `limit` if it never does. */
const until = (start: MatchState, done: (state: MatchState) => boolean, limit = 200) => {
  let state = start;
  let frames = 0;
  while (!done(state) && frames < limit) {
    state = run(state, 1);
    frames += 1;
  }
  return { state, frames };
};

describe('Rivet, fighter 1 (#39)', () => {
  it('is a medium all-rounder on a stockier body of its own', () => {
    expect(RIVET.stats.weight).toBe(FIGHTER.weight);
    expect(RIVET.stats.walkSpeed).toBe(FIGHTER.walkSpeed);
    expect(RIVET.stats.airSpeed).toBe(FIGHTER.airSpeed);
    expect(RIVET.skeleton).not.toBe(CAPSULE.skeleton);
    expect(RIVET.stats.height).toBeLessThan(CAPSULE.stats.height);
    expect(RIVET.stats.width).toBeGreaterThan(CAPSULE.stats.width);
    // createMatch validates the definition, so a broken body would throw here.
    expect(fighter(match(false), 0).grounded).toBe(true);
  });

  it('has a move in every slot but the side special, which comes in S6', () => {
    const empty = PRESS_SLOTS.filter((slot) => RIVET.moves[slot] === undefined);
    expect(empty).toEqual(['sideSpecial']);
    expect(RIVET.moves.ledgeAttack).toBeDefined();
  });

  describe('neutral special: haymaker', () => {
    it('lunges forward into a punch that lands from beyond jab range', () => {
      const state = faceOff(1.6);
      // The jab does not reach that far.
      const jabbed = run(run(state, 1, [inputOf({ attack: true })]), 20);
      expect(fighter(jabbed, 1).damage).toBe(0);
      const started = run(state, 1, NEUTRAL_SPECIAL);
      expect(fighter(started, 0).moveId).toBe(RIVET.moves.neutralSpecial);
      const { state: hit, frames } = until(started, (s) => fighter(s, 1).action === 'hitstun', 40);
      expect(fighter(hit, 1).action).toBe('hitstun');
      // On its active frames, after the lunge has carried Rivet in.
      expect(frames).toBeGreaterThanOrEqual(18);
      expect(frames).toBeLessThanOrEqual(22);
      expect(fighter(hit, 0).position.x).toBeGreaterThan(0.3);
      expect(fighter(hit, 1).damage).toBe(18);
    });

    it('is slower than the forward smash but launches harder', () => {
      const haymaker = findMove(RIVET.moves.neutralSpecial ?? '');
      const smash = findMove(CAPSULE.moves.forwardSmash ?? '');
      const first = (move: typeof smash) => Math.min(...move.hitboxes.map((h) => h.from));
      const strongest = (move: typeof smash) =>
        Math.max(...move.hitboxes.map((h) => knockback(h, 100 + h.damage, 1)));
      expect(first(haymaker)).toBeGreaterThan(first(smash));
      expect(haymaker.totalFrames).toBeGreaterThan(smash.totalFrames);
      expect(strongest(haymaker)).toBeGreaterThan(strongest(smash));
    });
  });

  describe('up special: spring jack', () => {
    it('rises higher than a full jump, then leaves Rivet helpless', () => {
      const started = run(match(false), 1, UP_SPECIAL);
      expect(fighter(started, 0).moveId).toBe(RIVET.moves.upSpecial);
      const ground = fighter(started, 0).position.y;
      let peak = ground;
      let state = started;
      for (let i = 0; i < 40; i += 1) {
        state = run(state, 1);
        peak = Math.max(peak, fighter(state, 0).position.y);
      }
      const jumpHeight = RIVET.stats.jumpVelocity ** 2 / (2 * RIVET.stats.gravity);
      expect(peak - ground).toBeGreaterThan(jumpHeight * 1.1);
      expect(fighter(state, 0).action).toBe('helpless');
    });

    it('brings Rivet back to the ledge from below it, without jumps or air dodge', () => {
      const ledge = BATTLEFIELD.ledges[1] as LedgeDef;
      const below = withFighter(match(false), 0, {
        position: { x: ledge.position.x + 1.2, y: ledge.position.y - 2.5 },
        velocity: { x: 0, y: -0.1 },
        grounded: false,
        action: 'airborne',
        facing: -1,
        jumpsRemaining: 0,
        airDodgeUsed: true,
      });
      const started = run(below, 1, [inputOf({ x: -0.4, y: 1, special: true })]);
      const { state } = until(started, (s) => fighter(s, 0).action === 'ledge');
      expect(fighter(state, 0).action).toBe('ledge');
      expect(fighter(state, 0).ledge).toBe(1);
    });

    it('ends early with its own landing lag if Rivet touches down during it', () => {
      const low = withFighter(match(false), 0, {
        position: { x: 0, y: 0.5 },
        velocity: { x: 0, y: -0.3 },
        grounded: false,
        action: 'airborne',
      });
      // Pressed in the air just above the stage, it lands before it springs.
      const started = run(low, 1, UP_SPECIAL);
      expect(fighter(started, 0).moveId).toBe(RIVET.moves.upSpecial);
      const { state } = until(started, (s) => fighter(s, 0).grounded, 10);
      expect(fighter(state, 0).action).toBe('landing');
      expect(fighter(state, 0).landingLagFrames).toBe(14);
    });

    it('hits several times on the way up and launches with the last hit', () => {
      const state = faceOff(0.7);
      let next = run(state, 1, UP_SPECIAL);
      let hits = 0;
      for (let i = 0; i < 40; i += 1) {
        next = run(next, 1);
        hits += next.events.filter((e) => e.type === 'hit' && e.attacker === 0).length;
      }
      // Four carrying hits of 2% and the launcher of 5%, all landing.
      expect(hits).toBe(5);
      const target = fighter(next, 1);
      expect(target.damage).toBe(13);
      // The last hit sends the target on up, past Rivet, who has stopped rising.
      expect(target.position.y).toBeGreaterThan(fighter(next, 0).position.y + 1);
      expect(target.velocity.y).toBeGreaterThan(fighter(next, 0).velocity.y);
    });
  });
});
