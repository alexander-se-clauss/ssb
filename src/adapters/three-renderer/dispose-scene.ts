import * as THREE from 'three';

/** Release generated geometry, materials, textures and light shadow maps. */
export const disposeScene = (scene: THREE.Object3D): void => {
  scene.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.LineSegments ||
      object instanceof THREE.Points
    ) {
      object.geometry.dispose();
      const materials: THREE.Material[] = [object.material].flat();
      for (const material of materials) {
        // Generated stage textures hang off the materials.
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      }
    }
  });
  scene.traverse((object) => {
    if (object instanceof THREE.Light) object.dispose();
  });
};
