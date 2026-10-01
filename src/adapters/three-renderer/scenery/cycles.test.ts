import { describe, expect, it } from 'vitest';
import { DAY_LENGTH, DESTINATION_LENGTH, destinationAt, skyAt } from './cycles';

describe('Battlefield sky', () => {
  it('starts at day without stars and reaches a starry night', () => {
    expect(skyAt(0).stars).toBe(0);
    expect(skyAt(0).sunHeight).toBeGreaterThan(0);
    expect(skyAt(DAY_LENGTH * 0.5).stars).toBe(1);
    expect(skyAt(DAY_LENGTH * 0.5).sunHeight).toBeLessThan(0);
  });

  it('loops', () => {
    expect(skyAt(DAY_LENGTH + 7)).toEqual(skyAt(7));
  });

  it('changes smoothly from frame to frame', () => {
    for (let seconds = 0; seconds < DAY_LENGTH; seconds += 1 / 60) {
      const step = Math.abs(skyAt(seconds + 1 / 60).zenith[0] - skyAt(seconds).zenith[0]);
      expect(step).toBeLessThan(0.01);
    }
  });
});

describe('Final Destination backdrop', () => {
  it('shows one scene at a time, with weights that add up to 1', () => {
    for (let seconds = 0; seconds < DESTINATION_LENGTH; seconds += 0.5) {
      const { warp, nebula, planet } = destinationAt(seconds);
      expect(warp + nebula + planet).toBeCloseTo(1);
    }
    expect(destinationAt(0).warp).toBe(1);
    expect(destinationAt(DESTINATION_LENGTH / 3).nebula).toBe(1);
    expect(destinationAt((DESTINATION_LENGTH * 2) / 3).planet).toBe(1);
  });
});
