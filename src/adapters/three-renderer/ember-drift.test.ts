import { describe, expect, it } from 'vitest';
import { emberHeight } from './ember-drift';

describe('emberHeight', () => {
  it('starts where the ember was placed', () => {
    expect(emberHeight(2, 0.5, 0, { bottom: 0, top: 10 })).toBe(2);
  });

  it('rises with time', () => {
    expect(emberHeight(2, 0.5, 4, { bottom: 0, top: 10 })).toBeCloseTo(4);
  });

  it('starts again at the bottom once it rose past the top', () => {
    expect(emberHeight(9, 1, 3, { bottom: 0, top: 10 })).toBeCloseTo(2);
    expect(emberHeight(9, 1, 23, { bottom: 0, top: 10 })).toBeCloseTo(2);
  });

  it('keeps to a band that starts below the floor', () => {
    expect(emberHeight(11, 1, 3, { bottom: -1, top: 12 })).toBeCloseTo(1);
    expect(emberHeight(-1, 1, 0, { bottom: -1, top: 12 })).toBe(-1);
  });
});
