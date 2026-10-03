import * as THREE from 'three';
import type { EffectId } from '../../core';
import { glowTexture } from './firelit-set';
import type { Burst } from './hit-effects';
import { EFFECTS, ParticlePool } from './particles';
import { seededRandom } from './scenery/noise';

/** Bursts (hits, KOs) show in front of the fighters, not inside their bodies. */
const BURST_DEPTH = 0.6;

/** One place an effect is burning this moment: where, and how far towards the camera. */
export interface Emitter {
  readonly effect: EffectId;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

/**
 * Draws the particle effects (#47): one pool and one cloud of points per preset in
 * `particles.ts`. Each drawing, every emitter feeds its pool for the game frames that passed,
 * and the pools move on by the same frames, so a paused match freezes its fire.
 */
export class EffectLayer {
  private readonly clouds: { pool: ParticlePool; points: THREE.Points }[] = [];
  private readonly byId = new Map<string, ParticlePool>();

  constructor(scene: THREE.Scene) {
    const map = glowTexture();
    // A fixed seed: the same flames every run at the same frame pacing, so screenshots compare.
    const random = seededRandom(47);
    for (const [id, preset] of Object.entries(EFFECTS)) {
      const pool = new ParticlePool(preset, random);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(preset.capacity * 3), 3),
      );
      // Four channels: each particle fades out on its own.
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(new Float32Array(preset.capacity * 4), 4),
      );
      const points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: preset.size,
          map,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
        }),
      );
      // Particles move anywhere; skip culling against the first frame's bounds.
      points.frustumCulled = false;
      points.renderOrder = 3;
      scene.add(points);
      this.clouds.push({ pool, points });
      this.byId.set(id, pool);
    }
  }

  /**
   * Steps every pool by `frames` elapsed game frames, then feeds it from `emitters` and the
   * one-off `bursts`.
   */
  update(emitters: readonly Emitter[], bursts: readonly Burst[], frames: number): void {
    for (const { pool } of this.clouds) pool.step(frames);
    for (const { effect, x, y, count, power } of bursts) {
      this.byId.get(effect)?.emit(x, y, BURST_DEPTH, count, power);
    }
    for (const emitter of emitters) {
      this.byId.get(emitter.effect)?.emitFor(emitter.x, emitter.y, emitter.depth, frames);
    }
    for (const { pool, points } of this.clouds) {
      const position = points.geometry.getAttribute('position');
      const color = points.geometry.getAttribute('color');
      const colors = color.array as Float32Array;
      for (let i = 0; i < pool.preset.capacity; i += 1) {
        position.setXYZ(i, pool.x[i] ?? 0, pool.y[i] ?? 0, pool.z[i] ?? 0);
        pool.writeColor(i, colors, i * 4);
      }
      position.needsUpdate = true;
      color.needsUpdate = true;
    }
  }
}
