import { describe, expect, it } from 'vitest';
import { BOX_COLORS, hurtboxColor } from './debug-colors';

describe('debug overlay colours', () => {
  it('gives hurtboxes, invulnerable hurtboxes and hitboxes each their own colour', () => {
    const colors = Object.values(BOX_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('draws hurtboxes in the invulnerable colour while a fighter cannot be hit', () => {
    expect(hurtboxColor({ invulnerableFrames: 0 })).toBe(BOX_COLORS.hurtbox);
    expect(hurtboxColor({ invulnerableFrames: 1 })).toBe(BOX_COLORS.invulnerable);
    expect(hurtboxColor({ invulnerableFrames: 120 })).toBe(BOX_COLORS.invulnerable);
  });
});
