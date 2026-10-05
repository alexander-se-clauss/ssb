import type { MoveDef } from '../moves';
import { POSES } from '../pose-data';

/**
 * The standing grab (#159): both arms reach out in front. Quick, but short-ranged, and a whiff
 * leaves the fighter open for most of the move.
 */
export const GRAB_MOVE: MoveDef = {
  kind: 'attack',
  id: 'grab',
  totalFrames: 30,
  hitboxes: [],
  grab: { anchor: { feet: { x: 0.75, y: 1.0 } }, radius: 0.45, from: 7, to: 9 },
  poses: [
    { frame: 0, pose: POSES.idle },
    { frame: 6, pose: POSES.grab },
    { frame: 10, pose: POSES.grab },
    { frame: 26, pose: POSES.idle },
  ],
  cancels: [],
};

/**
 * The dash grab (#159), out of a dash or run: it lunges on and reaches further, but comes out
 * later and leaves the fighter open longer on a whiff.
 */
export const DASH_GRAB: MoveDef = {
  kind: 'attack',
  id: 'dashGrab',
  totalFrames: 40,
  hitboxes: [],
  grab: { anchor: { feet: { x: 0.95, y: 0.9 } }, radius: 0.5, from: 10, to: 13 },
  motion: [{ frame: 1, x: 0.14 }],
  poses: [
    { frame: 0, pose: POSES.run },
    { frame: 8, pose: POSES.grab },
    { frame: 14, pose: POSES.grab },
    { frame: 34, pose: POSES.idle },
  ],
  cancels: [],
};

/**
 * The pivot grab (#159), out of a run turn: the fighter swings round to grab the way it was
 * running from, reaching further than standing, at a cost in startup.
 */
export const PIVOT_GRAB: MoveDef = {
  kind: 'attack',
  id: 'pivotGrab',
  totalFrames: 36,
  hitboxes: [],
  grab: { anchor: { feet: { x: 0.9, y: 1.0 } }, radius: 0.5, from: 12, to: 15 },
  poses: [
    { frame: 0, pose: POSES.runTurn },
    { frame: 10, pose: POSES.grab },
    { frame: 16, pose: POSES.grab },
    { frame: 32, pose: POSES.idle },
  ],
  cancels: [],
};
