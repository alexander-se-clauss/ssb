import type { StageDef } from './types';

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
  blastZone: { left: -16, right: 16, bottom: -9, top: 14 },
};
