import { describe, expect, it } from 'vitest';
import { FIGHTER, LEDGE } from './config';
import { findMove } from './move-data';
import { createMatch, step } from './simulation';
import { BATTLEFIELD, FINAL_DESTINATION } from './stages';
import { CAPSULE, RIVET, VELA } from './registry';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

const SHORT_HOP = inputOf({ shortHop: true });
const JUMP = inputOf({ jump: true });
const NAIR = inputOf({ attack: true });
const NONE = inputOf({});

/** One fighter of `characterId` standing still in the middle of Final Destination. */
const standing = (characterId: string = CAPSULE.id): MatchState => {
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
}

/** Presses `button` once and lets the hop play out with nothing held. */
const hop = (characterId: string, button: PlayerInput): Hop => {
  let state = step(standing(characterId), [button]);
  let airborne = 0;
  let apex = 0;
  for (let frame = 0; frame < 400; frame += 1) {
    state = step(state, [NONE]);
    const f = fighter(state, 0);
    if (!f.grounded) {
      airborne += 1;
      apex = Math.max(apex, f.position.y);
    } else if (airborne > 0) {
      return { airtime: airborne + 1, apex };
    }
  }
  throw new Error(`${characterId} never landed`);
};

/** Steps until the fighter has just left the ground, pressing `first` on the first frame. */
const takeOff = (state: MatchState, first: PlayerInput): MatchState => {
  let now = step(state, [first]);
  while (fighter(now, 0).grounded) now = step(now, [NONE]);
  return now;
};

/** Pinned per fighter: about 30 frames in the air, the same order of floatiness as the full hop. */
const PINNED = [
  { id: CAPSULE.id, airtime: 29, apex: 1.802 },
  { id: RIVET.id, airtime: 29, apex: 1.925 },
  { id: VELA.id, airtime: 30, apex: 1.56 },
];

describe('short hop button (#147)', () => {
  it.each(PINNED)('$id: a short hop lasts $airtime frames and peaks at $apex', (pinned) => {
    const short = hop(pinned.id, SHORT_HOP);
    expect(short.airtime).toBe(pinned.airtime);
    expect(short.apex).toBeCloseTo(pinned.apex, 3);
  });

  it.each(PINNED)('$id: a short hop is roughly 30 frames, well below the full hop', ({ id }) => {
    const short = hop(id, SHORT_HOP);
    const full = hop(id, JUMP);
    expect(short.airtime).toBeGreaterThanOrEqual(26);
    expect(short.airtime).toBeLessThanOrEqual(34);
    expect(short.apex).toBeLessThan(full.apex * 0.65);
  });

  it('crouches for the same jump squat as the full jump', () => {
    const state = step(standing(), [SHORT_HOP]);
    expect(fighter(state, 0).action).toBe('jumpsquat');
    const air = run(state, FIGHTER.jumpSquatFrames, [NONE]);
    expect(fighter(air, 0).grounded).toBe(false);
    expect(fighter(air, 0).velocity.y).toBeCloseTo(FIGHTER.shortHopVelocity - FIGHTER.gravity);
  });

  it('lands a neutral air started at take-off before the aerial ends, with its landing lag', () => {
    const nair = findMove(CAPSULE.moves.neutralAir ?? '');
    let state = step(takeOff(standing(), SHORT_HOP), [NAIR]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: nair.id });
    while (!fighter(state, 0).grounded) state = step(state, [NONE]);
    const landed = fighter(state, 0);
    expect(landed.action).toBe('landing');
    expect(landed.landingLagFrames).toBe(nair.landingLag);
  });

  it('lets the same neutral air play out in the air after a full hop', () => {
    const nair = findMove(CAPSULE.moves.neutralAir ?? '');
    let state = step(takeOff(standing(), JUMP), [NAIR]);
    state = run(state, nair.totalFrames, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'airborne', grounded: false });
  });

  it('is a full jump when jump and short hop are pressed together', () => {
    const both = hop(CAPSULE.id, inputOf({ jump: true, shortHop: true }));
    expect(both.apex).toBeCloseTo(hop(CAPSULE.id, JUMP).apex, 3);
  });

  it('forgets the short hop when a move cuts the jump squat short', () => {
    const squat = step(standing(), [SHORT_HOP]);
    const smash = step(squat, [inputOf({ attack: true, y: 1 })]);
    expect(fighter(smash, 0)).toMatchObject({ action: 'attack', shortHop: false });
  });

  it('jumps in the air like the jump button, with the air jump', () => {
    let state = run(takeOff(standing(), JUMP), 5, [NONE]);
    state = step(state, [SHORT_HOP]);
    expect(fighter(state, 0).jumpsRemaining).toBe(FIGHTER.airJumps - 1);
    expect(fighter(state, 0).velocity.y).toBeCloseTo(FIGHTER.airJumpVelocity - FIGHTER.gravity);
  });

  it('stays a short hop when pressed during landing lag and buffered', () => {
    let state = withFighter(standing(), 0, { action: 'landing', landingLagFrames: 4 });
    state = step(state, [SHORT_HOP]);
    while (fighter(state, 0).grounded) state = step(state, [NONE]);
    let apex = 0;
    while (!fighter(state, 0).grounded) {
      apex = Math.max(apex, fighter(state, 0).position.y);
      state = step(state, [NONE]);
    }
    expect(apex).toBeCloseTo(hop(CAPSULE.id, SHORT_HOP).apex, 2);
  });

  it('jumps off a ledge like the jump button', () => {
    let state = run(
      createMatch({
        stageId: BATTLEFIELD.id,
        players: [{ characterId: CAPSULE.id }],
        rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
        countdownFrames: 0,
      }),
      1,
    );
    state = withFighter(state, 0, { action: 'ledge', actionFrame: LEDGE.waitFrames, ledge: 1 });
    state = step(state, [SHORT_HOP]);
    expect(fighter(state, 0).action).toBe('airborne');
    expect(fighter(state, 0).velocity.y).toBeGreaterThan(0);
  });
});
