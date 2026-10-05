import { describe, expect, it } from 'vitest';
import { SDI } from './config';
import { CAPSULE, RIVET } from './registry';
import { createMatch, step } from './simulation';
import { FINAL_DESTINATION } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

const NONE = inputOf({});
const SMASH = inputOf({ x: 1, attack: true });
const LEFT = inputOf({ x: -1 });

/** `attacker` at the centre of Final Destination facing right, a capsule `gap` in front. */
const faceOff = (attacker: string, gap: number, damage = 80): MatchState => {
  let state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [{ characterId: attacker }, { characterId: CAPSULE.id }],
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
    position: { x: gap, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: -1,
    grounded: true,
    action: 'idle',
    damage,
  });
};

/** P1 forward smashes P2; the state on the frame of the hit. */
const smashHit = (): MatchState => {
  let state = step(faceOff(CAPSULE.id, 0.9), [SMASH, NONE]);
  for (let i = 0; i < 60 && !state.events.some((e) => e.type === 'hit'); i += 1) {
    state = step(state, [NONE, NONE]);
  }
  return state;
};

/** Plays P2's hitlag with `stick(frame)` held on each of its frames; the state once it is over. */
const throughHitlag = (state: MatchState, stick: (frame: number) => PlayerInput): MatchState => {
  let now = state;
  for (let frame = 0; fighter(now, 1).hitlagFrames > 0; frame += 1) {
    now = step(now, [NONE, stick(frame)]);
  }
  return now;
};

const xAfter = (stick: (frame: number) => PlayerInput): number =>
  fighter(throughHitlag(smashHit(), stick), 1).position.x;

describe('smash DI during hitlag (#155)', () => {
  it('has a hitlag long enough on a smash for several flicks', () => {
    expect(fighter(smashHit(), 1).hitlagFrames).toBeGreaterThanOrEqual(6);
  });

  it(`moves the target ${SDI.distance} units for one flick from the centre`, () => {
    const plain = xAfter(() => NONE);
    const flicked = xAfter((frame) => (frame === 0 ? LEFT : NONE));
    expect(flicked).toBeCloseTo(plain - SDI.distance, 9);
  });

  it('moves it further with each fresh flick', () => {
    const plain = xAfter(() => NONE);
    // Flick, back to the centre, flick: three flicks in the first six frames.
    const flicked = xAfter((frame) => (frame < 6 && frame % 2 === 0 ? LEFT : NONE));
    expect(flicked).toBeCloseTo(plain - 3 * SDI.distance, 9);
  });

  it('moves it only once for a stick held through the whole freeze', () => {
    const plain = xAfter(() => NONE);
    // Held straight back: along the launch, so DI does not turn it either.
    const state = throughHitlag(smashHit(), () => LEFT);
    expect(fighter(state, 1).position.x).toBeCloseTo(plain - SDI.distance, 9);
  });

  it(`ignores a flick that stays below ${SDI.threshold} of the way to the rim`, () => {
    const plain = xAfter(() => NONE);
    const soft = inputOf({ x: -(SDI.threshold - 0.05) });
    expect(xAfter((frame) => (frame === 0 ? soft : NONE))).toBeCloseTo(plain, 9);
  });

  it('never pushes a fighter on the ground down into the stage', () => {
    const state = smashHit();
    expect(fighter(state, 1).position.y).toBe(0);
    let now = state;
    for (let frame = 0; fighter(now, 1).hitlagFrames > 0; frame += 1) {
      now = step(now, [NONE, frame % 2 === 0 ? inputOf({ y: -1 }) : NONE]);
      expect(fighter(now, 1).position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('moves a fighter up off the ground, though', () => {
    const up = throughHitlag(smashHit(), (frame) => (frame === 0 ? inputOf({ y: 1 }) : NONE));
    expect(fighter(up, 1).position.y).toBeCloseTo(SDI.distance, 1);
  });

  /** P2 frozen by a hit at `position`, standing or not, with `stick` flicked on the next frame. */
  const frozenAt = (position: { x: number; y: number }, grounded: boolean, stick: PlayerInput) =>
    fighter(
      step(
        withFighter(faceOff(CAPSULE.id, 3), 1, {
          position,
          grounded,
          velocity: { x: 0, y: 0 },
          knockback: { x: 0, y: 0 },
          action: 'hitstun',
          hitstunFrames: 30,
          hitlagFrames: 5,
          previousInput: NONE,
        }),
        [NONE, stick],
      ),
      1,
    );

  it('never pushes a fighter at the edge down past the stage top, even flicked outwards', () => {
    const edge = FINAL_DESTINATION.platforms[0]?.bounds.right ?? 0;
    const after = frozenAt({ x: edge - 0.2, y: 0 }, true, inputOf({ x: 1, y: -1 }));
    expect(after.position.x).toBeGreaterThan(edge - 0.2);
    expect(after.position.y).toBe(0);
  });

  it('keeps it out of the stage over several flicks: out past the edge, then down', () => {
    const edge = FINAL_DESTINATION.platforms[0]?.bounds.right ?? 0;
    const half = CAPSULE.stats.width / 2;
    let state = withFighter(faceOff(CAPSULE.id, 3), 1, {
      position: { x: edge - 0.2, y: 0 },
      grounded: true,
      velocity: { x: 0, y: 0 },
      knockback: { x: 0, y: 0 },
      action: 'hitstun',
      hitstunFrames: 30,
      hitlagFrames: 5,
      previousInput: NONE,
    });
    state = run(state, 1, [NONE, inputOf({ x: 1 })]);
    state = run(state, 1, [NONE, NONE]);
    state = run(state, 1, [NONE, inputOf({ y: -1 })]);
    const after = fighter(state, 1);
    // Part of its body is still over the stage, so it stays on top of it.
    expect(after.position.x - half).toBeLessThan(edge);
    expect(after.position.y).toBe(0);
  });

  it('stops at the side of the stage instead of pushing into it', () => {
    const edge = FINAL_DESTINATION.platforms[0]?.bounds.right ?? 0;
    const half = CAPSULE.stats.width / 2;
    const after = frozenAt({ x: edge + half + 0.1, y: -1 }, false, LEFT);
    expect(after.position.x).toBeCloseTo(edge + half, 9);
  });

  it('is no longer on the ground once a flick lifts it', () => {
    const after = frozenAt({ x: 0, y: 0 }, true, inputOf({ y: 1 }));
    expect(after).toMatchObject({ grounded: false });
    expect(after.position.y).toBeCloseTo(SDI.distance, 9);
  });

  it("lets a fighter slip out of a multi-hit move: Rivet's spring jack", () => {
    const UP_SPECIAL = inputOf({ y: 1, special: true });
    const hits = (sdi: boolean): number => {
      let state = step(faceOff(RIVET.id, 0.7, 0), [UP_SPECIAL, NONE]);
      let count = 0;
      let last = NONE;
      for (let i = 0; i < 40; i += 1) {
        // Flicking away from Rivet on each frame of hitlag, back to the centre in between.
        const frozen = fighter(state, 1).hitlagFrames > 0;
        const stick = sdi && frozen && last === NONE ? inputOf({ x: 1 }) : NONE;
        last = stick;
        state = step(state, [NONE, stick]);
        count += state.events.filter((e) => e.type === 'hit' && e.attacker === 0).length;
      }
      return count;
    };
    expect(hits(true)).toBeLessThan(hits(false));
  });
});
