import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './time';

describe('FixedStepClock', () => {
  it('runs no ticks on the first call', () => {
    expect(new FixedStepClock(10).advance(1000)).toBe(0);
  });

  it('turns elapsed time into whole ticks and keeps the remainder', () => {
    const clock = new FixedStepClock(10);
    clock.advance(0);
    expect(clock.advance(25)).toBe(2);
    expect(clock.alpha).toBeCloseTo(0.5);
    expect(clock.advance(30)).toBe(1);
  });

  it('caps catch-up ticks after a long pause', () => {
    const clock = new FixedStepClock(10, 5);
    clock.advance(0);
    expect(clock.advance(10_000)).toBe(5);
    expect(clock.alpha).toBe(0);
  });
});
