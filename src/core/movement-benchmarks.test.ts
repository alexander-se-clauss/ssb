import { describe, expect, it } from 'vitest';
import { characterOf } from './character';
import { createMatch, step } from './simulation';
import { FINAL_DESTINATION } from './stages';
import { CAPSULE, RIVET, VELA } from './registry';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

/**
 * The movement benchmarks (#152): the numbers per fighter that define how the game feels, all
 * measured through `step` the way a player would produce them. A change here is a change to the
 * tempo, so it should be a deliberate one (see "Movement feel" in `docs/product.md`).
 */

const NONE = inputOf({});
const RIGHT = inputOf({ x: 1 });
const LEFT = inputOf({ x: -1 });
const DOWN = inputOf({ y: -1 });

/** One fighter of `characterId` standing still in the middle of Final Destination. */
const standing = (characterId: string): MatchState => {
  const state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [{ characterId }],
      rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
      countdownFrames: 0,
    }),
    120,
  );
  return withFighter(state, 0, {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    action: 'idle',
  });
};

const p1 = (state: MatchState) => fighter(state, 0);

/** Steps until `done` holds, `input` chosen per step; returns the steps taken and the state. */
const until = (
  state: MatchState,
  input: (s: MatchState, n: number) => PlayerInput,
  done: (s: MatchState) => boolean,
): { steps: number; state: MatchState } => {
  let now = state;
  for (let n = 0; n < 600; n += 1) {
    if (done(now)) return { steps: n, state: now };
    now = step(now, [input(now, n)]);
  }
  throw new Error('never happened');
};

/** Frames in the air for a jump from `button`, nothing else pressed. */
const airtime = (characterId: string, button: PlayerInput): number => {
  const up = until(
    standing(characterId),
    (_, n) => (n === 0 ? button : NONE),
    (s) => !p1(s).grounded,
  );
  return (
    until(
      up.state,
      () => NONE,
      (s) => p1(s).grounded,
    ).steps + 1
  );
};

/**
 * Frames from the highest point of a full hop to the landing, counting the landing frame and
 * holding down once falling: the same convention as `air-physics.test.ts`.
 */
const fastFall = (characterId: string): number => {
  let state = standing(characterId);
  let frame = 0;
  let apex = { y: -Infinity, frame: 0 };
  let airborne = false;
  for (; frame < 400; frame += 1) {
    const f = p1(state);
    const falling = airborne && f.velocity.y <= 0;
    state = step(state, [falling ? DOWN : frame < 10 ? inputOf({ jump: true }) : NONE]);
    const next = p1(state);
    if (!next.grounded) {
      airborne = true;
      if (next.position.y > apex.y) apex = { y: next.position.y, frame };
    } else if (airborne) {
      return frame - apex.frame;
    }
  }
  throw new Error(`${characterId} never landed`);
};

/** Dash frames on which a flick back starts a dash the other way: the dash dance window. */
const dashDanceWindow = (characterId: string): number => {
  let frames = 0;
  for (let held = 1; held < 30; held += 1) {
    let state = run(standing(characterId), held, [RIGHT]);
    state = step(state, [LEFT]);
    if (p1(state).action === 'dash' && p1(state).facing === -1) frames += 1;
  }
  return frames;
};

/** Frames from a flick of the stick to full run speed. */
const toFullRun = (characterId: string): number => {
  const { runSpeed } = characterOf(characterId).stats;
  return until(
    standing(characterId),
    () => RIGHT,
    (s) => p1(s).action === 'run' && p1(s).velocity.x >= runSpeed - 1e-9,
  ).steps;
};

/** Frames until control comes back after a dodge from standing, and the distance it covers. */
const dodge = (characterId: string, stick: PlayerInput): { frames: number; distance: number } => {
  const start = standing(characterId);
  const { steps, state } = until(
    start,
    (_, n) => (n === 0 ? { ...stick, shield: true } : NONE),
    (s) => s !== start && p1(s).action === 'idle',
  );
  return { frames: steps, distance: Math.abs(p1(state).position.x - p1(start).position.x) };
};

/**
 * A short-hop neutral air started on the first frame in the air: frames from the press until the
 * fighter can act again on the ground, and the landing lag it paid, without and with an L-cancel.
 */
const shortHopNair = (characterId: string, lCancel: boolean) => {
  const up = until(
    standing(characterId),
    (_, n) => (n === 0 ? inputOf({ shortHop: true }) : NONE),
    (s) => !p1(s).grounded,
  );
  let state = step(up.state, [inputOf({ attack: true })]);
  // Pressed the frame before landing, if at all.
  const down = until(
    state,
    (s) => (lCancel && p1(run(s, 1, [NONE])).grounded ? inputOf({ shield: true }) : NONE),
    (s) => p1(s).grounded,
  );
  state = down.state;
  const lag = p1(state).landingLagFrames;
  const back = until(
    state,
    () => NONE,
    (s) => p1(s).action === 'idle',
  );
  return { total: up.steps + 1 + down.steps + back.steps, lag };
};

const measure = (id: string) => ({
  id,
  fullHop: airtime(id, inputOf({ jump: true })),
  shortHop: airtime(id, inputOf({ shortHop: true })),
  fastFall: fastFall(id),
  dashDance: dashDanceWindow(id),
  toFullRun: toFullRun(id),
  roll: dodge(id, RIGHT),
  sidestep: dodge(id, NONE).frames,
  nair: shortHopNair(id, false),
  nairLCancel: shortHopNair(id, true),
});

type Measured = ReturnType<typeof measure>;
const measured = new Map<string, Measured>();
/** Measured once per fighter, inside the test that first asks, so a failure fails that test. */
const measureOnce = (id: string): Measured => {
  const known = measured.get(id) ?? measure(id);
  measured.set(id, known);
  return known;
};

/** Pinned per fighter. Frames at 60 per second; "back" is when the fighter can act again. */
const BENCHMARKS = [
  {
    id: CAPSULE.id,
    fullHop: 40,
    shortHop: 29,
    fastFall: 9,
    dashDance: 10,
    toFullRun: 13,
    roll: { frames: 31, distance: 2.2 },
    sidestep: 23,
    nair: { total: 38, lag: 6 },
    nairLCancel: { total: 36, lag: 4 },
  },
  {
    id: RIVET.id,
    fullHop: 37,
    shortHop: 29,
    fastFall: 9,
    dashDance: 10,
    toFullRun: 13,
    roll: { frames: 31, distance: 2.2 },
    sidestep: 23,
    nair: { total: 38, lag: 6 },
    nairLCancel: { total: 36, lag: 4 },
  },
  {
    id: VELA.id,
    fullHop: 46,
    shortHop: 30,
    fastFall: 11,
    dashDance: 9,
    toFullRun: 12,
    roll: { frames: 31, distance: 2.2 },
    sidestep: 23,
    nair: { total: 39, lag: 6 },
    nairLCancel: { total: 37, lag: 4 },
  },
];

describe('movement benchmarks (#152)', () => {
  describe.each(BENCHMARKS)('$id', (pinned) => {
    it(`is in the air ${pinned.fullHop} frames on a full hop, ${pinned.shortHop} on a short hop`, () => {
      expect(measureOnce(pinned.id).fullHop).toBe(pinned.fullHop);
      expect(measureOnce(pinned.id).shortHop).toBe(pinned.shortHop);
    });

    it(`fast-falls from the top of a full hop, landing frame included, in ${pinned.fastFall} frames`, () => {
      expect(measureOnce(pinned.id).fastFall).toBe(pinned.fastFall);
    });

    it(`dash dances on ${pinned.dashDance} frames and runs at full speed after ${pinned.toFullRun}`, () => {
      expect(measureOnce(pinned.id).dashDance).toBe(pinned.dashDance);
      expect(measureOnce(pinned.id).toFullRun).toBe(pinned.toFullRun);
    });

    it('rolls and sidesteps with the shared dodge frame data', () => {
      expect(measureOnce(pinned.id).roll.frames).toBe(pinned.roll.frames);
      expect(measureOnce(pinned.id).roll.distance).toBeCloseTo(pinned.roll.distance, 6);
      expect(measureOnce(pinned.id).sidestep).toBe(pinned.sidestep);
    });

    it(`is back ${pinned.nair.total} frames after a short-hop nair, ${pinned.nairLCancel.total} with an L-cancel`, () => {
      expect(measureOnce(pinned.id).nair).toEqual(pinned.nair);
      expect(measureOnce(pinned.id).nairLCancel).toEqual(pinned.nairLCancel);
    });
  });

  describe('the shape of the tempo', () => {
    const all = () => BENCHMARKS.map((b) => measureOnce(b.id));

    it('keeps a short hop below four fifths of a full hop in the air', () => {
      for (const m of all()) expect(m.shortHop, m.id).toBeLessThan(m.fullHop * 0.8);
    });

    it('makes a short-hop nair and back fit in under 40 frames, two thirds of a second', () => {
      for (const m of all()) expect(m.nair.total, m.id).toBeLessThan(40);
    });

    it('lets an L-cancel save frames on a short-hop nair', () => {
      for (const m of all()) expect(m.nairLCancel.total, m.id).toBeLessThan(m.nair.total);
    });

    it('keeps Vela the longest in the air on a full hop and Rivet the shortest', () => {
      const [capsule, rivet, vela] = all();
      expect(vela?.fullHop).toBeGreaterThan(capsule?.fullHop ?? 0);
      expect(rivet?.fullHop).toBeLessThan(capsule?.fullHop ?? 0);
    });
  });
});
