import { describe, expect, it } from 'vitest';
import { wipeGeometry, wipeAt } from './screen-wipe';

describe('screen wipe geometry', () => {
  const geometry = wipeGeometry(1280, 720);

  it('starts with the old screen whole and the blades off screen to the left', () => {
    const start = wipeAt(geometry, 0);
    expect(start.bladeX + geometry.bladeWidth + geometry.slant).toBeLessThanOrEqual(0);
    // The edge of the old screen is left of the screen at both the top and the bottom.
    expect(start.edgeTop).toBeLessThanOrEqual(0);
    expect(start.edgeBottom).toBeLessThanOrEqual(0);
  });

  it('ends with the old screen gone and the blades off screen to the right', () => {
    const end = wipeAt(geometry, 1);
    expect(end.bladeX).toBeGreaterThanOrEqual(1280);
    expect(end.edgeTop).toBeGreaterThanOrEqual(1280);
    expect(end.edgeBottom).toBeGreaterThanOrEqual(1280);
  });

  it('keeps the edge of the old screen under the blades, so no seam shows', () => {
    for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const { bladeX, edgeTop, edgeBottom } = wipeAt(geometry, progress);
      // The blades are a parallelogram: bottom from bladeX, top shifted right by the slant.
      expect(edgeBottom).toBeGreaterThan(bladeX);
      expect(edgeBottom).toBeLessThan(bladeX + geometry.bladeWidth);
      expect(edgeTop).toBeGreaterThan(bladeX + geometry.slant);
      expect(edgeTop).toBeLessThan(bladeX + geometry.slant + geometry.bladeWidth);
    }
  });

  it('slants the blades with the screen height and keeps them wide on narrow screens', () => {
    const portrait = wipeGeometry(390, 844);
    expect(portrait.slant).toBeGreaterThan(0);
    expect(portrait.bladeWidth).toBeGreaterThanOrEqual(320);
    expect(wipeGeometry(1280, 1440).slant).toBeGreaterThan(geometry.slant);
  });
});
