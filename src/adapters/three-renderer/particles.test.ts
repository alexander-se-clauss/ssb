import { describe, expect, it } from 'vitest';
import { MOVES } from '../../core';
import { seededRandom } from './scenery/noise';
import { EFFECTS, ParticlePool, hasEffect, type EffectPreset } from './particles';

const FIRE = EFFECTS['fire'] as EffectPreset;

const pool = (preset: EffectPreset = FIRE) => new ParticlePool(preset, seededRandom(3));

const colorOf = (particles: ParticlePool, index: number): [number, number, number, number] => {
  const out = new Float32Array(4);
  particles.writeColor(index, out, 0);
  return [out[0] ?? 0, out[1] ?? 0, out[2] ?? 0, out[3] ?? 0];
};

const living = (particles: ParticlePool): number[] =>
  Array.from({ length: particles.preset.capacity }, (_, i) => i).filter((i) => particles.alive(i));

describe('particles (#47)', () => {
  it('has a look for every effect the move data names', () => {
    const named = Object.values(MOVES).flatMap((move) => [
      ...(move.effects ?? []).map((key) => key.effect),
      ...(move.spawns ?? []).flatMap((spawn) => (spawn.effect ? [spawn.effect] : [])),
    ]);
    expect(named).toContain('fire');
    for (const id of named) expect(hasEffect(id), id).toBe(true);
  });

  it('emits at the preset rate per game frame, carrying fractions over', () => {
    const slow = pool({ ...FIRE, rate: 0.5 });
    slow.emitFor(0, 0, 0, 1);
    expect(slow.aliveCount).toBe(0);
    slow.emitFor(0, 0, 0, 1);
    expect(slow.aliveCount).toBe(1);
    const fire = pool();
    fire.emitFor(0, 0, 0, 2);
    expect(fire.aliveCount).toBe(FIRE.rate * 2);
  });

  it('starts particles around the emitter', () => {
    const fire = pool();
    fire.emit(2, 1, 0.3, 20);
    for (const i of living(fire)) {
      expect(Math.hypot((fire.x[i] ?? 0) - 2, (fire.y[i] ?? 0) - 1)).toBeLessThanOrEqual(
        FIRE.jitter + 1e-6,
      );
    }
  });

  it('lets fire rise, and every particle die after its life', () => {
    const fire = pool();
    fire.emit(0, 0, 0, 30);
    fire.step(10);
    const heights = living(fire).map((i) => fire.y[i] ?? 0);
    const mean = heights.reduce((sum, y) => sum + y, 0) / heights.length;
    expect(mean).toBeGreaterThan(0.2);
    fire.step(FIRE.life - 10);
    expect(fire.aliveCount).toBe(0);
  });

  it('holds still while no game frames pass, as in a pause', () => {
    const fire = pool();
    fire.emit(0, 0, 0, 10);
    const before = Array.from(fire.y);
    fire.step(0);
    fire.emitFor(0, 0, 0, 0);
    expect(Array.from(fire.y)).toEqual(before);
    expect(fire.aliveCount).toBe(10);
  });

  it('cools and fades out as a particle ages', () => {
    const fire = pool();
    fire.emit(0, 0, 0, 1);
    const [index] = living(fire);
    if (index === undefined) throw new Error('no particle');
    const [, greenBorn, , born] = colorOf(fire, index);
    fire.step(FIRE.life * 0.75);
    const [, greenOld, , old] = colorOf(fire, index);
    expect(old).toBeLessThan(born / 2);
    // Yellow-orange cools towards red: less green.
    expect(greenOld).toBeLessThan(greenBorn);
    fire.step(FIRE.life);
    expect(colorOf(fire, index)[3]).toBe(0);
  });

  it('never holds more than its capacity: the oldest make room', () => {
    const small = pool({ ...FIRE, capacity: 8 });
    small.emit(0, 0, 0, 20);
    expect(small.aliveCount).toBe(8);
  });

  it('draws the same with the same seed', () => {
    const a = pool();
    const b = pool();
    for (const particles of [a, b]) {
      particles.emitFor(1, 1, 0, 3);
      particles.step(3);
    }
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
  });
});
