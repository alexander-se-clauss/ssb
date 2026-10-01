import { describe, expect, it } from 'vitest';
import { circleIntersectsCapsule, vec2 } from './math';

describe('circle against capsule', () => {
  const a = vec2(0, 0);
  const b = vec2(0, 2);

  it('touches along the side, measured from the nearest point of the segment', () => {
    expect(circleIntersectsCapsule(vec2(0.5, 1), 0.3, a, b, 0.2)).toBe(true);
    expect(circleIntersectsCapsule(vec2(0.51, 1), 0.3, a, b, 0.2)).toBe(false);
  });

  it('has round ends, so a circle off the corner can miss', () => {
    expect(circleIntersectsCapsule(vec2(0, 2.5), 0.3, a, b, 0.2)).toBe(true);
    // Inside the bounding box corner but farther than the reach from the end point.
    expect(circleIntersectsCapsule(vec2(0.4, 2.4), 0.3, a, b, 0.2)).toBe(false);
  });

  it('works as a ball when both ends meet', () => {
    expect(circleIntersectsCapsule(vec2(0.3, 0.4), 0.3, a, a, 0.2)).toBe(true);
    expect(circleIntersectsCapsule(vec2(0.3, 0.41), 0.3, a, a, 0.2)).toBe(false);
  });
});
