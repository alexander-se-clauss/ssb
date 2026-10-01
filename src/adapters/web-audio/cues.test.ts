import { describe, expect, it } from 'vitest';
import { CUES, shapeCue } from './cues';

describe('shapeCue', () => {
  it('plays a cue as designed at medium strength', () => {
    expect(shapeCue('hit', 0.5)).toEqual(CUES.hit);
  });

  it('makes a strong hit louder, lower and longer than a weak one', () => {
    const [weak] = shapeCue('hit', 0);
    const [strong] = shapeCue('hit', 1);
    expect(strong?.gain).toBeGreaterThan(weak?.gain ?? Infinity);
    expect(strong?.from).toBeLessThan(weak?.from ?? 0);
    expect(strong?.duration).toBeGreaterThan(weak?.duration ?? Infinity);
  });

  it('keeps every tone within full volume', () => {
    for (const cue of Object.keys(CUES) as (keyof typeof CUES)[]) {
      for (const tone of shapeCue(cue, 1)) expect(tone.gain).toBeLessThanOrEqual(1);
    }
  });

  it('plays menu cues the same whatever the strength', () => {
    expect(shapeCue('menu-move', 1)).toEqual(CUES['menu-move']);
  });
});
