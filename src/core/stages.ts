import type { PlatformDef, StageDef } from './types';

/** Feet at `(x, y)` stand on top of `platform`. */
export const standsOn = (x: number, y: number, platform: PlatformDef): boolean =>
  x >= platform.bounds.left &&
  x <= platform.bounds.right &&
  Math.abs(y - platform.bounds.top) < 1e-6;

/** A Battlefield-style layout: one solid main stage and three pass-through platforms. */
export const BATTLEFIELD: StageDef = {
  id: 'battlefield',
  name: 'Battlefield',
  platforms: [
    { bounds: { left: -7, right: 7, bottom: -2, top: 0 }, passThrough: false },
    { bounds: { left: -5, right: -2, bottom: 2.1, top: 2.2 }, passThrough: true },
    { bounds: { left: 2, right: 5, bottom: 2.1, top: 2.2 }, passThrough: true },
    { bounds: { left: -1.5, right: 1.5, bottom: 4.1, top: 4.2 }, passThrough: true },
  ],
  spawnPoints: [
    { x: -3.5, y: 3 },
    { x: 3.5, y: 3 },
    { x: -1, y: 5 },
    { x: 1, y: 5 },
  ],
  ledges: [
    { position: { x: -7, y: 0 }, facing: 1 },
    { position: { x: 7, y: 0 }, facing: -1 },
  ],
  // Melee-like room past the ledges to fight and recover off-stage (#42).
  blastZone: { left: -22, right: 22, bottom: -11, top: 20 },
};

/** A Final Destination-style layout: one wide, flat stage with no platforms. */
export const FINAL_DESTINATION: StageDef = {
  id: 'final-destination',
  name: 'Final Destination',
  platforms: [{ bounds: { left: -9, right: 9, bottom: -2, top: 0 }, passThrough: false }],
  spawnPoints: [
    { x: -4, y: 2 },
    { x: 4, y: 2 },
    { x: -1.5, y: 2 },
    { x: 1.5, y: 2 },
  ],
  ledges: [
    { position: { x: -9, y: 0 }, facing: 1 },
    { position: { x: 9, y: 0 }, facing: -1 },
  ],
  blastZone: { left: -26, right: 26, bottom: -13, top: 20 },
};
