import { describe, expect, it } from 'vitest';
import {
  MIN_CAMERA_DISTANCE,
  PLATFORM_SPACING,
  platformX,
  rowCameraDistance,
} from './lobby-layout';

describe('lobby layout', () => {
  it('spaces the four platforms evenly around the middle', () => {
    expect([0, 1, 2, 3].map(platformX)).toEqual([
      -1.5 * PLATFORM_SPACING,
      -0.5 * PLATFORM_SPACING,
      0.5 * PLATFORM_SPACING,
      1.5 * PLATFORM_SPACING,
    ]);
  });

  it('backs the camera off until the whole row fits the width of the screen', () => {
    const halfFov = (30 / 2) * (Math.PI / 180);
    for (const aspect of [16 / 9, 4 / 3, 0.46]) {
      const distance = rowCameraDistance(30, aspect);
      const halfWidth = Math.tan(halfFov) * aspect * distance;
      // Each platform's column is a quarter of the screen, so its centre is at 1/8, 3/8, ...
      expect(halfWidth * 0.75).toBeCloseTo(platformX(3), 5);
    }
  });

  it('never comes so close on a wide screen that the fighters leave the top', () => {
    const halfFov = (30 / 2) * (Math.PI / 180);
    const widthFit = platformX(3) / 0.75 / (Math.tan(halfFov) * 4);
    expect(rowCameraDistance(30, 4)).toBe(MIN_CAMERA_DISTANCE);
    expect(MIN_CAMERA_DISTANCE).toBeGreaterThan(widthFit);
  });
});
