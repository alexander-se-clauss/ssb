import { describe, expect, it } from 'vitest';
import { jitter, seededRandom, tilingNoise } from './noise';

describe('noise', () => {
  it('repeats for the same seed', () => {
    const a = seededRandom(5);
    const b = seededRandom(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('tiles, so textures repeat without seams', () => {
    expect(tilingNoise(0.3, 0.7, 8, 1)).toBeCloseTo(tilingNoise(8.3, 8.7, 8, 1));
  });

  it('gives vertices at the same position the same offset', () => {
    expect(jitter(1.2, -3, 0.5, 9)).toBe(jitter(1.2000001, -3, 0.5, 9));
  });
});
