import { describe, expect, it } from 'vitest';
import { knockback } from './combat';
import { findMove } from './move-data';
import { PRESS_SLOTS } from './move-slots';
import { RIVET, VELA } from './registry';
import { createMatch, step } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { LedgeDef, MatchState, PlayerInput } from './types';

const NONE = inputOf({});
const NEUTRAL_SPECIAL = inputOf({ special: true });
const UP_SPECIAL = inputOf({ y: 1, special: true });

/** `p1` against `p2` on Battlefield, settled, with no countdown. */
const match = (p1: string, p2: string): MatchState =>
  run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: p1 }, { characterId: p2 }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );

/** P1 at the centre facing right, P2 `gap` in front of it facing back. */
const faceOff = (p1: string, p2: string, gap: number): MatchState => {
  const state = withFighter(match(p1, p2), 0, {
    position: { x: 0, y: 0 },
    facing: 1,
    grounded: true,
  });
  return withFighter(state, 1, { position: { x: gap, y: 0 }, facing: -1, grounded: true });
};

/** Plays `frames` frames with P1 on `input` and P2 idle. */
const hold = (state: MatchState, input: PlayerInput, frames: number): MatchState =>
  run(state, frames, [input, NONE]);

/** How far P1 runs right in `frames` frames from a standstill. */
const runDistance = (characterId: string, frames: number): number => {
  const start = withFighter(match(characterId, characterId), 0, {
    position: { x: -3, y: 0 },
    grounded: true,
  });
  return fighter(hold(start, inputOf({ x: 1 }), frames), 0).position.x + 3;
};

/** The highest P1 gets from the ground with a full jump and every air jump, pressed at the top. */
const peakHeight = (characterId: string): number => {
  let state = match(characterId, characterId);
  const ground = fighter(state, 0).position.y;
  let peak = ground;
  let pressed = false;
  for (let i = 0; i < 240; i += 1) {
    const f = fighter(state, 0);
    // Jump once from the ground, then again each time the rise stops.
    const jump: boolean = !pressed && (f.grounded || f.velocity.y <= 0);
    state = step(state, [inputOf({ jump }), NONE]);
    pressed = jump;
    peak = Math.max(peak, fighter(state, 0).position.y);
  }
  return peak - ground;
};

describe('Vela, fighter 2 (#53)', () => {
  it('has two air jumps where Rivet has one', () => {
    expect(VELA.stats.airJumps).toBe(2);
    expect(RIVET.stats.airJumps).toBe(1);
  });

  it('outruns Rivet on the ground', () => {
    expect(runDistance(VELA.id, 40)).toBeGreaterThan(runDistance(RIVET.id, 40) * 1.1);
  });

  it('climbs higher on her jumps, with a second air jump', () => {
    expect(peakHeight(VELA.id)).toBeGreaterThan(peakHeight(RIVET.id) * 1.3);
  });

  it('flies further than Rivet from the same hit, so she dies earlier', () => {
    const smash = findMove('forwardSmash').hitboxes[0];
    if (!smash) throw new Error('The forward smash has a hitbox');
    const launch = (weight: number) => knockback(smash, 100, weight);
    expect(launch(VELA.stats.weight)).toBeGreaterThan(launch(RIVET.stats.weight) * 1.1);
    // In a match: Rivet's forward smash on Vela, and Vela's on Rivet, both at 80%.
    const sent = (attacker: string, target: string) => {
      let state = withFighter(faceOff(attacker, target, 0.9), 1, { damage: 80 });
      state = hold(state, inputOf({ x: 1, attack: true }), 1);
      state = hold(state, NONE, 60);
      return Math.abs(fighter(state, 1).position.x - 0.9);
    };
    expect(sent(RIVET.id, VELA.id)).toBeGreaterThan(sent(VELA.id, RIVET.id));
  });

  it('has a move in every slot but the side special, which comes with #49', () => {
    const empty = PRESS_SLOTS.filter((slot) => VELA.moves[slot] === undefined);
    expect(empty).toEqual(['sideSpecial']);
    expect(VELA.moves.downSpecial).toBe('riposte');
  });

  describe('neutral special: pulse shot', () => {
    it('fires a shot from her cannon that hits from across the stage', () => {
      // Far beyond the reach of Rivet's lunging haymaker.
      let state = hold(faceOff(VELA.id, RIVET.id, 5), NEUTRAL_SPECIAL, 1);
      expect(fighter(state, 0).moveId).toBe(VELA.moves.neutralSpecial);
      let hitAt = -1;
      for (let i = 0; i < 60 && hitAt < 0; i += 1) {
        state = hold(state, NONE, 1);
        expect(fighter(state, 0).position.x).toBeLessThan(0.1);
        if (state.events.some((e) => e.type === 'hit' && e.attacker === 0)) hitAt = i;
      }
      expect(hitAt).toBeGreaterThan(0);
      expect(fighter(state, 1).damage).toBeGreaterThan(0);
      expect(fighter(state, 1).lastHitBy).toBe(0);
    });

    it('fires in the air too, and the shot flies on as she falls', () => {
      let state = withFighter(faceOff(VELA.id, RIVET.id, 4), 0, {
        position: { x: 0, y: 2 },
        velocity: { x: 0, y: 0 },
        grounded: false,
        action: 'airborne',
      });
      state = hold(state, NEUTRAL_SPECIAL, 1);
      expect(fighter(state, 0).moveId).toBe(VELA.moves.neutralSpecial);
      state = hold(state, NONE, 16);
      expect(state.objects.length).toBe(1);
      // Fired from the cannon high above the stage, flying straight ahead.
      expect(state.objects[0]?.position.y).toBeGreaterThan(1.5);
      expect(state.objects[0]?.velocity).toEqual({ x: expect.any(Number), y: 0 });
      expect(state.objects[0]?.velocity.x).toBeGreaterThan(0);
    });

    it('is blocked by Rivet from the front: block against zoning (#50)', () => {
      let state = faceOff(VELA.id, RIVET.id, 4);
      state = run(state, 1, [NEUTRAL_SPECIAL, inputOf({ y: -1, special: true })]);
      let guarded: string | undefined;
      for (let i = 0; i < 60 && guarded === undefined; i += 1) {
        state = run(state, 1, [NONE, NEUTRAL_SPECIAL]);
        const hit = state.events.find((e) => e.type === 'hit' && e.target === 1);
        if (hit?.type === 'hit') guarded = hit.guard ?? 'none';
      }
      expect(guarded).toBe('blocked');
    });
  });

  describe('up special: thruster', () => {
    it('boosts her up and forward, further sideways than Spring Jack, then leaves her helpless', () => {
      const travel = (characterId: string, upSpecial: string | undefined) => {
        const start = match(characterId, characterId);
        const from = fighter(start, 0).position;
        let state = hold(start, UP_SPECIAL, 1);
        expect(fighter(state, 0).moveId).toBe(upSpecial);
        let peak = from.y;
        for (let i = 0; i < 40; i += 1) {
          state = hold(state, NONE, 1);
          peak = Math.max(peak, fighter(state, 0).position.y);
        }
        return { state, x: fighter(state, 0).position.x - from.x, rise: peak - from.y };
      };
      const vela = travel(VELA.id, VELA.moves.upSpecial);
      const rivet = travel(RIVET.id, RIVET.moves.upSpecial);
      expect(vela.x).toBeGreaterThan(rivet.x + 1);
      expect(vela.rise).toBeGreaterThan(2);
      expect(fighter(vela.state, 0).action).toBe('helpless');
    });

    it('brings her back to the ledge from further out than Rivet, without jumps or air dodge', () => {
      const ledge = BATTLEFIELD.ledges[1] as LedgeDef;
      const recover = (characterId: string) => {
        let state = withFighter(match(characterId, RIVET.id), 0, {
          position: { x: ledge.position.x + 7, y: ledge.position.y - 2 },
          velocity: { x: 0, y: -0.1 },
          grounded: false,
          action: 'airborne',
          facing: -1,
          jumpsRemaining: 0,
          airDodgeUsed: true,
        });
        state = hold(state, inputOf({ x: -0.4, y: 1, special: true }), 1);
        for (let i = 0; i < 150 && fighter(state, 0).action !== 'ledge'; i += 1) {
          state = hold(state, inputOf({ x: -1 }), 1);
        }
        return fighter(state, 0);
      };
      expect(recover(VELA.id)).toMatchObject({ action: 'ledge', ledge: 1 });
      expect(recover(RIVET.id).action).not.toBe('ledge');
    });

    it('hits a fighter it rams late in the boost, not only at the start', () => {
      const boost = (state: MatchState, frame: number) => {
        let next = hold(state, UP_SPECIAL, 1);
        while (fighter(next, 0).actionFrame < frame) next = hold(next, NONE, 1);
        return next;
      };
      // Where the boost carries her by frame 22, with nobody in the way.
      const alone = withFighter(match(VELA.id, RIVET.id), 1, { position: { x: -6, y: 0 } });
      const ahead = fighter(boost(alone, 22), 0).position;
      // Rivet hangs there in the air as she reaches frame 18.
      let state = boost(alone, 18);
      state = withFighter(state, 1, {
        position: { x: ahead.x, y: ahead.y },
        velocity: { x: 0, y: 0 },
        grounded: false,
        action: 'airborne',
      });
      state = hold(state, NONE, 8);
      expect(fighter(state, 1).damage).toBeGreaterThan(0);
    });

    it('knocks away a fighter it boosts through', () => {
      let state = hold(faceOff(VELA.id, RIVET.id, 0.6), UP_SPECIAL, 1);
      state = hold(state, NONE, 30);
      expect(fighter(state, 1).damage).toBeGreaterThan(0);
    });
  });
});
