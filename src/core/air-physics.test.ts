import { describe, expect, it } from 'vitest';
import { createMatch, step } from './simulation';
import { FINAL_DESTINATION } from './stages';
import { CAPSULE, RIVET, VELA } from './registry';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState } from './types';

const JUMP = inputOf({ jump: true });
const DOWN = inputOf({ y: -1 });
const NONE = inputOf({});

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
  return withFighter(state, 0, { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } });
};

interface Hop {
  /** Frames from leaving the ground to landing again. */
  readonly airtime: number;
  /** Highest point above the ground. */
  readonly apex: number;
  /** Frames from the apex to the ground, falling normally or holding down. */
  readonly fall: number;
}

/** A full hop (jump held through the jump squat), holding `fallInput` once it starts falling. */
const fullHop = (characterId: string, fallInput = NONE): Hop => {
  let state = standing(characterId);
  const ground = fighter(state, 0).position.y;
  let airborne = 0;
  let apex = 0;
  let apexFrame = 0;
  for (let frame = 0; frame < 400; frame += 1) {
    const f = fighter(state, 0);
    const falling = airborne > 0 && f.velocity.y <= 0;
    state = step(state, [falling ? fallInput : airborne > 0 || frame < 10 ? JUMP : NONE]);
    const next = fighter(state, 0);
    if (!next.grounded) {
      airborne += 1;
      if (next.position.y - ground > apex) {
        apex = next.position.y - ground;
        apexFrame = airborne;
      }
    } else if (airborne > 0) {
      return { airtime: airborne + 1, apex, fall: airborne + 1 - apexFrame };
    }
  }
  throw new Error(`${characterId} never landed`);
};

/**
 * Pinned per fighter, Melee-near (#145): a full hop of about 40 frames for the all-rounder, a
 * stocky, quicker faller and a floaty light one, and a fast fall that lands in well under half
 * the time of a normal fall from the apex.
 */
const PINNED = [
  { id: CAPSULE.id, airtime: 40, apex: 3.32, fall: 21, fastFall: 9 },
  { id: RIVET.id, airtime: 37, apex: 3.23, fall: 19, fastFall: 9 },
  { id: VELA.id, airtime: 46, apex: 3.59, fall: 24, fastFall: 11 },
];

describe('air physics (#145)', () => {
  it.each(PINNED)('$id: a full hop lasts $airtime frames and peaks at $apex', (pinned) => {
    const hop = fullHop(pinned.id);
    expect(hop.airtime).toBe(pinned.airtime);
    expect(hop.apex).toBeCloseTo(pinned.apex, 2);
    expect(hop.fall).toBe(pinned.fall);
  });

  it.each(PINNED)('$id: a fast fall from the apex lands in $fastFall frames', (pinned) => {
    expect(fullHop(pinned.id, DOWN).fall).toBe(pinned.fastFall);
  });

  it('drops at full fast-fall speed at once, as in Melee', () => {
    const hop = fullHop(CAPSULE.id, DOWN);
    expect(hop.fall).toBeLessThan(fullHop(CAPSULE.id).fall / 2);
  });

  it('keeps the all-rounder near 40 frames and orders the fighters by how floaty they are', () => {
    const [capsule, rivet, vela] = PINNED.map((p) => fullHop(p.id).airtime);
    expect(capsule).toBeGreaterThanOrEqual(38);
    expect(capsule).toBeLessThanOrEqual(42);
    expect(rivet).toBeLessThan(capsule ?? 0);
    expect(vela).toBeGreaterThan(capsule ?? 0);
  });

  it('reaches the side platforms of Battlefield with a full hop', () => {
    for (const { id } of PINNED) expect(fullHop(id).apex).toBeGreaterThan(2.2 + 0.5);
  });
});
