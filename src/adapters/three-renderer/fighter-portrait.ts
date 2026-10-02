import * as THREE from 'three';
import { POSES, type CharacterDef } from '../../core';
import { fighterModel, NEUTRAL_COLOR, poseFighter, PLAYER_COLORS } from './fighter-model';
import { disposeScene } from './dispose-scene';

const portraits = new WeakMap<CharacterDef, readonly string[]>();

/** Capture a neutral roster portrait and four gameplay-color variants using one temporary context. */
export const fighterPortrait = (character: CharacterDef, player?: number): string => {
  let images = portraits.get(character);
  if (!images) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const scene = new THREE.Scene();
    try {
      renderer.setSize(480, 480);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      scene.add(new THREE.HemisphereLight(0xe0edff, 0x17263d, 2.8));
      const key = new THREE.DirectionalLight(0xffe6c9, 3);
      key.position.set(-3, 5, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x80bfff, 3);
      rim.position.set(3, 2, -3);
      scene.add(rim);
      const model = fighterModel(character.id, NEUTRAL_COLOR);
      poseFighter(model, POSES.idle);
      model.root.rotation.y = -0.4;
      scene.add(model.root);
      const bounds = new THREE.Box3().setFromObject(model.root);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const half = Math.max(size.y, size.x) * 0.58;
      const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 30);
      camera.position.set(center.x, center.y + 0.1, 8);
      camera.lookAt(center);
      images = [NEUTRAL_COLOR, ...PLAYER_COLORS].map((color) => {
        model.tint(color);
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      });
      portraits.set(character, images);
    } finally {
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
  return images[player === undefined ? 0 : player + 1] ?? images[0] ?? '';
};
