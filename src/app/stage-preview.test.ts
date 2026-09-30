import { describe, expect, it } from 'vitest';
import type { StageDef } from '../core';
import { previewRects } from './stage-preview';

const STAGE: StageDef = {
  id: 't',
  name: 'Test',
  platforms: [
    { bounds: { left: -5, right: 5, bottom: -1, top: 0 }, passThrough: false },
    { bounds: { left: -1, right: 1, bottom: 1.9, top: 2 }, passThrough: true },
  ],
  spawnPoints: [{ x: 0, y: 1 }],
  blastZone: { left: -10, right: 10, bottom: -5, top: 5 },
};

describe('stage preview', () => {
  it('maps platforms into a 0..1 box with y pointing down, as on screen', () => {
    const [floor, ledge] = previewRects(STAGE);
    expect(floor).toEqual({ x: 0.25, y: 0.5, width: 0.5, height: 0.1, passThrough: false });
    expect(ledge?.x).toBeCloseTo(0.45);
    expect(ledge?.y).toBeCloseTo(0.3);
    expect(ledge?.passThrough).toBe(true);
  });

  it('gives thin platforms a minimum height so they stay visible', () => {
    const ledge = previewRects(STAGE)[1];
    expect(ledge?.height).toBeGreaterThanOrEqual(0.02);
  });
});
