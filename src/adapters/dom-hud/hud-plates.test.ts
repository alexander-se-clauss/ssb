import { describe, expect, it } from 'vitest';
import { HEAT_FULL_DAMAGE, heat, plateLayout, stockMarks } from './hud-plates';

describe('heat', () => {
  it('fills the damage meter as damage rises, and stays full beyond the top', () => {
    expect(heat(0)).toBe(0);
    expect(heat(HEAT_FULL_DAMAGE / 2)).toBeCloseTo(0.5);
    expect(heat(HEAT_FULL_DAMAGE)).toBe(1);
    expect(heat(999)).toBe(1);
  });
});

describe('stockMarks', () => {
  it('shows one diamond per starting life, filled for the lives left', () => {
    expect(stockMarks(2, 3)).toEqual([true, true, false]);
    expect(stockMarks(0, 3)).toEqual([false, false, false]);
  });

  it('gives up on diamonds when there are too many to read at a glance', () => {
    expect(stockMarks(7, 8)).toBeNull();
  });
});

describe('plateLayout', () => {
  it('gives two players long bars, one on each side of the timer', () => {
    expect(plateLayout(2)).toEqual({ compact: false, sides: ['left', 'right'] });
  });

  it('gives three or four players compact plates, two on the left of the timer', () => {
    expect(plateLayout(3)).toEqual({ compact: true, sides: ['left', 'left', 'right'] });
    expect(plateLayout(4)).toEqual({
      compact: true,
      sides: ['left', 'left', 'right', 'right'],
    });
  });
});
