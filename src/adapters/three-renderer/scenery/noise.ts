/**
 * Seeded randomness for generated textures and rocks, so a stage looks the same on every visit.
 * Visual only: the simulation never reads any of this.
 */

/** A small, fast seeded generator (mulberry32). Returns numbers in [0, 1). */
export const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A repeatable value in [0, 1) for a lattice point. */
const hash = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Smooth value noise in [0, 1) that tiles every `period` units on both axes. */
export const tilingNoise = (x: number, y: number, period: number, seed: number): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const wrap = (v: number): number => ((v % period) + period) % period;
  const sx = smooth(x - x0);
  const sy = smooth(y - y0);
  const at = (dx: number, dy: number): number => hash(wrap(x0 + dx), wrap(y0 + dy), seed);
  const top = at(0, 0) + (at(1, 0) - at(0, 0)) * sx;
  const bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * sx;
  return top + (bottom - top) * sy;
};

/** Several octaves of tiling noise; `period` is the tile size of the first octave. */
export const tilingFbm = (
  x: number,
  y: number,
  period: number,
  seed: number,
  octaves = 4,
): number => {
  let sum = 0;
  let amplitude = 0.5;
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    const scale = 2 ** octave;
    sum += tilingNoise(x * scale, y * scale, period * scale, seed + octave) * amplitude;
    total += amplitude;
    amplitude /= 2;
  }
  return sum / total;
};

/**
 * A repeatable offset in [-1, 1) for a point in space. Vertices that share a position (the seam
 * of a cylinder) get the same offset, so displaced meshes stay closed.
 */
export const jitter = (x: number, y: number, z: number, seed: number): number => {
  const q = (v: number): number => Math.round(v * 1000);
  return hash(q(x) + q(z) * 7919, q(y), seed) * 2 - 1;
};
