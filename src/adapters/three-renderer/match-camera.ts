/**
 * The match camera (#43): a Smash-style camera that zooms and pans to keep every fighter in
 * frame, off-stage too, without looking past the blast zone. View-only: it reads where fighters
 * are drawn and never touches game state. The framing is plain math so it can be tested
 * without WebGL.
 */
import type * as THREE from 'three';
import type { Rect } from '../../core';

export const CAMERA = {
  /** Vertical field of view in degrees. */
  fov: 40,
  /** Closest the camera comes to the stage plane, so a lone fighter is not filling the screen. */
  minDistance: 16,
  /** Room kept around the fighters' bodies, in stage units. */
  margin: 1.5,
  /** Most of the screen height the HUD across the top may keep from the fighters. */
  maxHudShare: 0.4,
  /** The camera sits this far above the point it looks at, for a slight view onto the stage. */
  lift: 1,
  /** Share of the way to its target the camera covers per game frame (60 per second). */
  follow: 0.08,
} as const;

/** Where the camera looks on the stage plane, and how far back from it it stands. */
export interface CameraFrame {
  readonly x: number;
  readonly y: number;
  readonly distance: number;
}

/** Where the camera starts, and where it rests with nobody left to frame. */
export const restingFrame = (blastZone: Rect): CameraFrame => ({
  x: (blastZone.left + blastZone.right) / 2,
  y: 2,
  distance: CAMERA.minDistance,
});

const tanHalfFov = (): number => Math.tan(((CAMERA.fov / 2) * Math.PI) / 180);

/** `centre` moved so a view `half` wide either side stays within `min..max`, if it fits. */
const keepInside = (centre: number, half: number, min: number, max: number): number =>
  half * 2 >= max - min ? (min + max) / 2 : Math.min(Math.max(centre, min + half), max - half);

/**
 * The frame that shows every body box with some margin, as close as allowed, in the part of the
 * screen below the HUD (`hudShare` of its height at the top). It backs off no further than it
 * takes to see the whole blast zone, and slides inwards so it does not look past the zone's
 * edges, except where a body (a fighter about to be KO'd) reaches past them.
 */
export const frameFighters = (
  bodies: readonly Rect[],
  blastZone: Rect,
  aspect: number,
  hudShare = 0,
): CameraFrame => {
  if (bodies.length === 0) return restingFrame(blastZone);
  const left = Math.min(...bodies.map((b) => b.left)) - CAMERA.margin;
  const right = Math.max(...bodies.map((b) => b.right)) + CAMERA.margin;
  const bottom = Math.min(...bodies.map((b) => b.bottom)) - CAMERA.margin;
  const top = Math.max(...bodies.map((b) => b.top)) + CAMERA.margin;
  // KOs go by the feet, so a body and its margin can reach past the zone: the camera may follow.
  const bounds: Rect = {
    left: Math.min(blastZone.left, left),
    right: Math.max(blastZone.right, right),
    bottom: Math.min(blastZone.bottom, bottom),
    top: Math.max(blastZone.top, top),
  };
  const tan = tanHalfFov();
  // The screen below the HUD is what counts for the height: it is `usable` of the view's height,
  // and its middle sits `hud` of the half height below the view's middle.
  const hud = Math.min(Math.max(hudShare, 0), CAMERA.maxHudShare);
  const usable = 1 - hud;
  // Distance at which the view is `halfWidth` wide either side, or its usable part `halfHeight`.
  const forWidth = (halfWidth: number) => halfWidth / (tan * aspect);
  const forHeight = (halfHeight: number) => halfHeight / (tan * usable);
  const wholeArea = Math.max(
    forWidth((bounds.right - bounds.left) / 2),
    forHeight((bounds.top - bounds.bottom) / 2),
  );
  const needed = Math.max(forWidth((right - left) / 2), forHeight((top - bottom) / 2));
  const distance = Math.max(CAMERA.minDistance, Math.min(needed, wholeArea));
  const halfHeight = distance * tan;
  const halfWidth = halfHeight * aspect;
  const usableMiddle = keepInside(
    (bottom + top) / 2,
    halfHeight * usable,
    bounds.bottom,
    bounds.top,
  );
  return {
    x: keepInside((left + right) / 2, halfWidth, bounds.left, bounds.right),
    y: usableMiddle + hud * halfHeight,
    distance,
  };
};

/**
 * Moves the camera part of the way to `target`, eased over `frames` game frames (fractions
 * allowed). Splitting the same time into more or fewer drawings ends in the same place, so the
 * camera glides the same at any refresh rate.
 */
export const followCamera = (
  current: CameraFrame,
  target: CameraFrame,
  frames: number,
): CameraFrame => {
  const t = 1 - (1 - CAMERA.follow) ** Math.max(frames, 0);
  const towards = (from: number, to: number) => from + (to - from) * t;
  return {
    x: towards(current.x, target.x),
    y: towards(current.y, target.y),
    distance: towards(current.distance, target.distance),
  };
};

/**
 * `frame`, backed off just far enough that every body box (with its margin) shows below the HUD.
 * Gliding lags behind a fighter launched faster than the camera eases, so this keeps it in view:
 * the camera zooms out at once and glides back in once things calm down.
 */
export const keepInView = (
  frame: CameraFrame,
  bodies: readonly Rect[],
  aspect: number,
  hudShare = 0,
): CameraFrame => {
  if (bodies.length === 0) return frame;
  const hud = Math.min(Math.max(hudShare, 0), CAMERA.maxHudShare);
  // The view reaches `halfHeight` below the frame's point and `(1 - 2 * hud)` of it above, to
  // the HUD's lower edge; `halfHeight * aspect` to either side.
  const halfHeight = Math.max(
    ...bodies.map((b) =>
      Math.max(
        (Math.max(frame.x - b.left, b.right - frame.x) + CAMERA.margin) / aspect,
        frame.y - b.bottom + CAMERA.margin,
        (b.top + CAMERA.margin - frame.y) / (1 - 2 * hud),
      ),
    ),
  );
  const distance = halfHeight / tanHalfFov();
  return distance > frame.distance ? { ...frame, distance } : frame;
};

/** Points a Three.js camera at a frame: a little above it, looking down at the stage plane. */
export const placeCamera = (camera: THREE.PerspectiveCamera, frame: CameraFrame): void => {
  if (camera.fov !== CAMERA.fov) {
    camera.fov = CAMERA.fov;
    camera.updateProjectionMatrix();
  }
  camera.position.set(frame.x, frame.y + CAMERA.lift, frame.distance);
  camera.lookAt(frame.x, frame.y, 0);
};
