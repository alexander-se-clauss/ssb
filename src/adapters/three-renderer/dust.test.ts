import { describe, expect, it } from 'vitest';
import {
  CAPSULE,
  FINAL_DESTINATION,
  createMatch,
  inputOf,
  step,
  type FighterState,
  type MatchState,
  type PlayerInput,
} from '../../core';
import { dustFor } from './dust';
import { hasEffect } from './particles';

const NONE = inputOf({});
const RIGHT = inputOf({ x: 1 });
const LEFT = inputOf({ x: -1 });

/** P1 alone on Final Destination, standing still in the middle, facing right. */
const standing = (): MatchState => {
  let state = createMatch({
    stageId: FINAL_DESTINATION.id,
    players: [{ characterId: CAPSULE.id }],
    rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
    countdownFrames: 0,
  });
  for (let i = 0; i < 120; i += 1) state = step(state, [NONE]);
  return patch(state, {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    action: 'idle',
  });
};

const patch = (state: MatchState, fields: Partial<FighterState>): MatchState => ({
  ...state,
  fighters: state.fighters.map((f) => (f.slot === 0 ? { ...f, ...fields } : f)),
});

const p1 = (state: MatchState): FighterState => {
  const fighter = state.fighters[0];
  if (!fighter) throw new Error('No P1');
  return fighter;
};

/** Plays the inputs and returns the dust of each frame, compared with the frame before. */
const play = (state: MatchState, inputs: readonly PlayerInput[]) => {
  let now = state;
  return inputs.map((input) => {
    const before = now;
    now = step(now, [input]);
    return { state: now, dust: dustFor(p1(before), p1(now)) };
  });
};

const hold = (input: PlayerInput, frames: number): PlayerInput[] =>
  Array<PlayerInput>(frames).fill(input);

describe('dash and landing dust (#151)', () => {
  it('has a dust look among the particle effects', () => {
    expect(hasEffect('dust')).toBe(true);
  });

  it('puffs behind the feet on an initial dash, once', () => {
    const frames = play(standing(), hold(RIGHT, 5));
    const first = frames[0]?.dust;
    expect(first).toMatchObject({ effect: 'dust', y: 0 });
    expect(first?.x).toBeLessThan(p1(frames[0]?.state ?? standing()).position.x);
    expect(frames.slice(1).every((f) => f.dust === undefined)).toBe(true);
  });

  it('puffs again on each turn of a dash dance', () => {
    const frames = play(standing(), [...hold(RIGHT, 4), ...hold(LEFT, 4), ...hold(RIGHT, 4)]);
    const puffs = frames.flatMap((f, i) => (f.dust ? [i] : []));
    expect(puffs).toEqual([0, 4, 8]);
    // Kicked up behind: to the right of a fighter dashing left.
    const turn = frames[4];
    expect(turn?.dust?.x).toBeGreaterThan(p1(turn?.state ?? standing()).position.x);
  });

  it('puffs when a run skids to a stop, and on a run turnaround', () => {
    const running = play(standing(), hold(RIGHT, 30)).at(-1)?.state ?? standing();
    expect(p1(running).action).toBe('run');
    const [skid, ...skidding] = play(running, hold(NONE, 5));
    expect(p1(skid?.state ?? running).action).toBe('skid');
    expect(skid?.dust?.effect).toBe('dust');
    expect(skidding.every((f) => f.dust === undefined)).toBe(true);
    const [turn] = play(running, [LEFT]);
    expect(p1(turn?.state ?? running).action).toBe('runTurn');
    expect(turn?.dust?.effect).toBe('dust');
  });

  it('puffs on the jump take-off, not in the jump squat', () => {
    const frames = play(standing(), [inputOf({ jump: true }), ...hold(NONE, 6)]);
    const takeOff = frames.findIndex((f) => !p1(f.state).grounded);
    expect(takeOff).toBeGreaterThan(0);
    expect(frames.flatMap((f, i) => (f.dust ? [i] : []))).toEqual([takeOff]);
    expect(frames[takeOff]?.dust).toMatchObject({ effect: 'dust', y: 0 });
  });

  it('puffs on a landing, bigger after a fast fall', () => {
    const falling = patch(standing(), {
      position: { x: 0, y: 3 },
      grounded: false,
      action: 'airborne',
    });
    const land = (input: PlayerInput) =>
      play(falling, hold(input, 80)).find((f) => f.dust !== undefined)?.dust;
    const soft = land(NONE);
    const fast = land(inputOf({ y: -1 }));
    expect(soft).toMatchObject({ effect: 'dust', x: 0, y: 0 });
    expect(fast?.count).toBeGreaterThan((soft?.count ?? 0) * 1.5);
    expect(fast?.power).toBeGreaterThan(soft?.power ?? 0);
  });

  it('still sees a landing when several frames passed between two drawings', () => {
    const falling = patch(standing(), { position: { x: 0, y: 0.5 }, grounded: false });
    let now = falling;
    for (let i = 0; i < 12; i += 1) now = step(now, [NONE]);
    expect(p1(now).grounded).toBe(true);
    expect(dustFor(p1(falling), p1(now))?.effect).toBe('dust');
  });

  it('stays still while walking, standing or running on', () => {
    const running = play(standing(), hold(RIGHT, 30)).at(-1)?.state ?? standing();
    expect(play(running, hold(RIGHT, 10)).every((f) => f.dust === undefined)).toBe(true);
    expect(play(standing(), hold(NONE, 10)).every((f) => f.dust === undefined)).toBe(true);
  });

  it('shows nothing for climbing up from a ledge or a respawn', () => {
    const fighter = p1(standing());
    const climbing = { ...fighter, grounded: false, action: 'ledgeStand' as const };
    expect(dustFor(climbing, { ...fighter, action: 'idle' })).toBeUndefined();
    const fallen = { ...fighter, grounded: true, falls: fighter.falls + 1 };
    expect(dustFor({ ...fighter, grounded: false }, fallen)).toBeUndefined();
  });
});
