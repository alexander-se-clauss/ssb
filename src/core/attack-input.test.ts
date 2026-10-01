import { describe, expect, it } from 'vitest';
import { STICK } from './config';
import { inputOf } from './input';
import {
  CENTRED_STICK,
  applyDeadzone,
  attackInput,
  trackStick,
  type StickTracker,
} from './attack-input';

/** Feeds stick positions one frame each and returns the tracker after the last one. */
const track = (...positions: readonly (readonly [number, number])[]): StickTracker =>
  positions.reduce(
    (tracker, [x, y]) => trackStick(tracker, inputOf({ x, y })),
    CENTRED_STICK as StickTracker,
  );

describe('stick deadzone', () => {
  it('treats small deflections as centred, so a worn stick does not drift', () => {
    expect(applyDeadzone(0.1)).toBe(0);
    expect(applyDeadzone(-0.15)).toBe(0);
    expect(applyDeadzone(STICK.deadzone)).toBe(STICK.deadzone);
    expect(applyDeadzone(-0.6)).toBe(-0.6);
  });

  it('gives a neutral attack while the stick rests inside the deadzone', () => {
    expect(attackInput(track([0.1, -0.1]), 1)).toEqual({ direction: 'neutral', strength: 'tilt' });
  });
});

describe('tilt and smash detection', () => {
  it('reads a soft push as a tilt, forward or back depending on facing', () => {
    const soft = track([0.5, 0], [0.5, 0]);
    expect(attackInput(soft, 1)).toEqual({ direction: 'forward', strength: 'tilt' });
    expect(attackInput(soft, -1)).toEqual({ direction: 'back', strength: 'tilt' });
  });

  it('reads a quick flick from the centre to the rim as a smash', () => {
    expect(attackInput(track([0, 0], [1, 0]), 1)).toEqual({
      direction: 'forward',
      strength: 'smash',
    });
    expect(attackInput(track([0, 1]), -1)).toEqual({ direction: 'up', strength: 'smash' });
    expect(attackInput(track([0, -1]), 1)).toEqual({ direction: 'down', strength: 'smash' });
  });

  it('still counts a flick that takes a few frames to reach the rim', () => {
    const steps = Array.from(
      { length: STICK.flickFrames },
      (_, index) => [((index + 1) / STICK.flickFrames) * 0.9, 0] as const,
    );
    expect(attackInput(track(...steps), 1).strength).toBe('smash');
  });

  it('reads a slow push to the rim as a tilt', () => {
    const slow = Array.from(
      { length: STICK.flickFrames + 3 },
      (_, index) => [0.3 + index * 0.15, 0] as const,
    );
    expect(slow.at(-1)?.[0]).toBeGreaterThanOrEqual(STICK.smash);
    expect(attackInput(track(...slow), 1)).toEqual({ direction: 'forward', strength: 'tilt' });
  });

  it('keeps a flick a smash for a few frames, then holding it is a tilt', () => {
    const held = (frames: number) =>
      track([1, 0], ...Array.from({ length: frames }, () => [1, 0] as const));
    expect(attackInput(held(STICK.smashWindowFrames - 1), 1).strength).toBe('smash');
    expect(attackInput(held(STICK.smashWindowFrames), 1).strength).toBe('tilt');
  });

  it('treats a keyboard direction pressed with attack as a smash, and held before it as a tilt', () => {
    // Keys jump straight from 0 to 1, which is the fastest possible flick.
    expect(attackInput(track([0, 0], [-1, 0]), -1)).toEqual({
      direction: 'forward',
      strength: 'smash',
    });
    const held = Array.from({ length: STICK.smashWindowFrames + 1 }, () => [-1, 0] as const);
    expect(attackInput(track(...held), -1).strength).toBe('tilt');
  });

  it('picks the stronger axis of a diagonal', () => {
    expect(attackInput(track([0.9, 0.5]), 1).direction).toBe('forward');
    expect(attackInput(track([0.4, -0.7]), 1).direction).toBe('down');
  });

  it('ends a flick when the stick rolls along the rim to another direction', () => {
    const rolled = track([1, 0], [1, 0], [0.95, 0.25], [0.9, 0.4], [0.7, 0.7], [0.4, 0.9], [0, 1]);
    expect(attackInput(rolled, 1)).toEqual({ direction: 'up', strength: 'tilt' });
  });

  it('times a flick along its own axis, so a flick that starts slightly off to the side counts', () => {
    // Up leaves the deadzone on the second frame and reaches the rim on the third.
    expect(attackInput(track([0.3, 0], [0, 0.4], [0, 0.8]), 1)).toEqual({
      direction: 'up',
      strength: 'smash',
    });
    // Up has been out for longer than a flick takes, so this is a tilt.
    expect(attackInput(track([0.3, 0.25], [0.2, 0.4], [0.3, 0.6], [0, 0.8]), 1)).toEqual({
      direction: 'up',
      strength: 'tilt',
    });
  });

  it('reads a keyboard reversal straight to the opposite key as a fresh flick', () => {
    // Releasing left and pressing right on one frame skips the centre that a stick passes.
    const reversed = track(...Array.from({ length: 6 }, () => [-1, 0] as const), [1, 0]);
    expect(attackInput(reversed, 1)).toEqual({ direction: 'forward', strength: 'smash' });
  });

  it('is plain data, so it can live in the match state', () => {
    const tracker = track([0, 0], [1, 0]);
    expect(JSON.parse(JSON.stringify(tracker))).toEqual(tracker);
  });
});
