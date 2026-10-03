import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BATTLEFIELD, FINAL_DESTINATION, type Rect } from '../../core';
import {
  CAMERA,
  followCamera,
  frameFighters,
  keepInView,
  placeCamera,
  type CameraFrame,
} from './match-camera';

const ASPECT = 16 / 9;
/** The HUD plates across the top cover about this much of a 720p screen. */
const HUD = 0.16;

/** A fighter's body box: standing at `x, y`, 0.8 wide and 1.6 tall. */
const body = (x: number, y: number): Rect => ({
  left: x - 0.4,
  right: x + 0.4,
  bottom: y,
  top: y + 1.6,
});

/** Where a point on the stage plane lands on screen, in -1..1 on both axes. */
const onScreen = (frame: CameraFrame, aspect: number, x: number, y: number) => {
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, aspect, 0.1, 200);
  placeCamera(camera, frame);
  camera.updateMatrixWorld();
  const point = new THREE.Vector3(x, y, 0).project(camera);
  return { x: point.x, y: point.y };
};

const visible = (frame: CameraFrame, aspect: number, box: Rect, hud = HUD): boolean =>
  [
    [box.left, box.bottom],
    [box.right, box.bottom],
    [box.left, box.top],
    [box.right, box.top],
  ].every(([x = 0, y = 0]) => {
    const p = onScreen(frame, aspect, x, y);
    // Below the HUD plates across the top of the screen.
    return Math.abs(p.x) < 1 && p.y > -1 && p.y < 1 - 2 * hud;
  });

describe('match camera framing', () => {
  it('keeps a fighter far off-stage in frame together with one on the stage', () => {
    const zone = BATTLEFIELD.blastZone;
    const fighters = [body(0, 0), body(zone.right - 1, -6)];
    const frame = frameFighters(fighters, zone, ASPECT, HUD);
    for (const box of fighters) expect(visible(frame, ASPECT, box)).toBe(true);
  });

  it('frames fighters high up and near every side of the blast zone, on both stages', () => {
    for (const { blastZone: zone } of [BATTLEFIELD, FINAL_DESTINATION]) {
      for (const fighters of [
        [body(zone.left + 1, 0), body(zone.right - 1, 0)],
        [body(0, zone.top - 2), body(0, zone.bottom + 0.5)],
        [body(zone.left + 1, zone.top - 2), body(3, 0)],
      ]) {
        for (const aspect of [ASPECT, 4 / 3, 9 / 16]) {
          const frame = frameFighters(fighters, zone, aspect, HUD);
          for (const box of fighters) expect(visible(frame, aspect, box)).toBe(true);
        }
      }
    }
  });

  it('follows a fighter whose body reaches past the blast zone, about to be KOd', () => {
    for (const { blastZone: zone } of [BATTLEFIELD, FINAL_DESTINATION]) {
      for (const fighters of [
        [body(0, zone.top - 0.1), body(0, 0)],
        [body(zone.right - 0.1, 3), body(-3, 0)],
        [body(zone.left + 0.1, zone.bottom + 0.1)],
      ]) {
        const frame = frameFighters(fighters, zone, ASPECT, HUD);
        for (const box of fighters) expect(visible(frame, ASPECT, box)).toBe(true);
      }
    }
  });

  it('keeps fighters below a HUD that covers more of a small screen', () => {
    const fighters = [body(-4, 12), body(6, 0)];
    for (const hud of [0, 0.25, 0.35]) {
      const frame = frameFighters(fighters, BATTLEFIELD.blastZone, 9 / 16, hud);
      for (const box of fighters) expect(visible(frame, 9 / 16, box, hud)).toBe(true);
    }
  });

  it('stays close when the fighters are close, and never closer than its minimum', () => {
    const near = frameFighters([body(-1, 0), body(1, 0)], BATTLEFIELD.blastZone, ASPECT);
    const far = frameFighters([body(-12, 0), body(12, 0)], BATTLEFIELD.blastZone, ASPECT);
    expect(near.distance).toBe(CAMERA.minDistance);
    expect(far.distance).toBeGreaterThan(near.distance);
  });

  it('does not look past the blast zone when it does not have to', () => {
    const zone = BATTLEFIELD.blastZone;
    const frame = frameFighters([body(zone.right - 3, 0)], zone, ASPECT);
    expect(onScreen(frame, ASPECT, zone.right, 0).x).toBeGreaterThanOrEqual(0.99);
  });
});

describe('match camera motion', () => {
  const start: CameraFrame = { x: 0, y: 2, distance: CAMERA.minDistance };

  it('settles on its target and then holds still', () => {
    const target: CameraFrame = { x: 6, y: 3, distance: 20 };
    let frame = start;
    for (let i = 0; i < 600; i += 1) frame = followCamera(frame, target, 1);
    expect(frame.x).toBeCloseTo(target.x, 3);
    const settled = followCamera(frame, target, 1);
    expect(Math.abs(settled.x - frame.x)).toBeLessThan(1e-4);
    expect(Math.abs(settled.distance - frame.distance)).toBeLessThan(1e-4);
  });

  it('moves the same way however the time between drawings is split', () => {
    const target: CameraFrame = { x: 6, y: 3, distance: 20 };
    const once = followCamera(start, target, 2);
    const twice = followCamera(followCamera(start, target, 0.5), target, 1.5);
    expect(twice.x).toBeCloseTo(once.x, 9);
    expect(twice.distance).toBeCloseTo(once.distance, 9);
  });

  it('glides without jitter while a fighter runs, at any drawing rate', () => {
    // A fighter running right at walking speed from the left of the stage to its middle, drawn at
    // uneven times between game frames.
    const zone = BATTLEFIELD.blastZone;
    const steps = [0.4, 0.6, 0.25, 0.75, 1, 0.3, 0.7, 0.5, 0.5, 0.9, 0.1];
    let time = 0;
    let frame = frameFighters([body(-6, 0), body(-8, 0)], zone, ASPECT);
    const xs: number[] = [];
    for (let i = 0; i < 150; i += 1) {
      const dt = steps[i % steps.length] ?? 1;
      time += dt;
      const target = frameFighters([body(-6 + time * 0.14, 0), body(-8, 0)], zone, ASPECT);
      frame = followCamera(frame, target, dt);
      xs.push(frame.x);
    }
    // Always moving the same way: no back-and-forth from one drawing to the next.
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i] ?? 0).toBeGreaterThanOrEqual((xs[i - 1] ?? 0) - 1e-9);
    }
  });

  it('backs off at once rather than lose a fighter launched faster than it glides', () => {
    // One fighter stays in the middle, the other flies sideways at launch speed until the zone.
    for (const { blastZone: zone } of [BATTLEFIELD, FINAL_DESTINATION]) {
      for (const aspect of [ASPECT, 9 / 16]) {
        const still = body(0, 0);
        let frame = frameFighters([still, body(1, 0)], zone, aspect, HUD);
        for (let x = 1; x < zone.right; x += 0.8) {
          const fighters = [still, body(x, 1 + x * 0.3)];
          const target = frameFighters(fighters, zone, aspect, HUD);
          frame = keepInView(followCamera(frame, target, 1), fighters, aspect, HUD);
          for (const box of fighters) expect(visible(frame, aspect, box)).toBe(true);
        }
      }
    }
  });

  it('leaves a frame alone that already shows every fighter', () => {
    const fighters = [body(-2, 0), body(2, 0)];
    const frame = frameFighters(fighters, BATTLEFIELD.blastZone, ASPECT, HUD);
    expect(keepInView(frame, fighters, ASPECT, HUD)).toEqual(frame);
  });
});
