import * as THREE from 'three';
import type { StageDef } from '../../core';
import { disposeScene } from './dispose-scene';
import { buildScenery } from './scenery';

const thumbnails = new WeakMap<StageDef, string>();

/** Capture the actual match scenery once; menu cards need no live WebGL contexts. */
export const stageThumbnail = (stage: StageDef): string => {
  const cached = thumbnails.get(stage);
  if (cached) return cached;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const scene = new THREE.Scene();
  try {
    renderer.setSize(640, 360);
    renderer.shadowMap.enabled = true;
    const scenery = buildScenery(scene, stage);
    scenery.update(0);
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
    const left = Math.min(...stage.platforms.map((p) => p.bounds.left));
    const right = Math.max(...stage.platforms.map((p) => p.bounds.right));
    const top = Math.max(...stage.platforms.map((p) => p.bounds.top));
    // Leave room for the island's underside and show the platform surfaces from above.
    const distance = Math.max(22, (right - left) * 1.5);
    camera.position.set((left + right) / 2, top / 2 + 6, distance);
    camera.lookAt((left + right) / 2, top / 2 - 1.5, 0);
    renderer.render(scene, camera);
    const image = renderer.domElement.toDataURL('image/png');
    thumbnails.set(stage, image);
    return image;
  } finally {
    disposeScene(scene);
    renderer.dispose();
    renderer.forceContextLoss();
  }
};
