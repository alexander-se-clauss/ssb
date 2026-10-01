import * as THREE from 'three';
import type { StageDef } from '../../../core';
import { battlefieldScenery } from './battlefield';
import { addLights, type Scenery } from './common';
import { finalDestinationScenery } from './final-destination';

export type { Scenery } from './common';

/** Plain blocks on a dark sky, for stages that have no scenery of their own yet. */
const plainScenery = (scene: THREE.Scene, stage: StageDef): Scenery => {
  scene.background = new THREE.Color(0x1b2140);
  scene.fog = new THREE.Fog(0x1b2140, 30, 80);
  addLights(scene, 0xbfd4ff, 0x2a2238);
  for (const platform of stage.platforms) {
    const { left, right, bottom, top } = platform.bounds;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(right - left, top - bottom, platform.passThrough ? 2 : 4),
      new THREE.MeshStandardMaterial({
        color: platform.passThrough ? 0x9aa7c7 : 0x5c6b8a,
        roughness: 0.8,
      }),
    );
    mesh.position.set((left + right) / 2, (top + bottom) / 2, 0);
    mesh.receiveShadow = true;
    mesh.castShadow = !platform.passThrough;
    scene.add(mesh);
  }
  return { update: () => undefined };
};

/** Each stage's look, by stage id. The look is built from the stage's platforms. */
const SCENERY: Readonly<Record<string, (scene: THREE.Scene, stage: StageDef) => Scenery>> = {
  battlefield: battlefieldScenery,
  'final-destination': finalDestinationScenery,
};

/** Adds a stage's platforms, backdrop and lights to the scene. */
export const buildScenery = (scene: THREE.Scene, stage: StageDef): Scenery =>
  (SCENERY[stage.id] ?? plainScenery)(scene, stage);
