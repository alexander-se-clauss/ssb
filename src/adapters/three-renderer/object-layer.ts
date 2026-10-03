import * as THREE from 'three';
import type { SpawnedObject } from '../../core';
import { PLAYER_COLORS } from './fighter-model';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Draws spawned objects (#45): a glowing ball in its owner's colour, the size of its hit circle,
 * followed by id from one game frame to the next.
 */
export class ObjectLayer {
  private readonly meshes = new Map<
    number,
    THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  >();
  private readonly geometry = new THREE.SphereGeometry(1, 16, 12);

  constructor(private readonly scene: THREE.Scene) {}

  /** Where the object with this id is drawn since the last `update`, if it is there. */
  drawnAt(id: number): THREE.Vector3 | undefined {
    return this.meshes.get(id)?.position;
  }

  /** Frees the shared ball shape; the scene frees the rest. */
  dispose(): void {
    this.geometry.dispose();
  }

  /** Places every object in `current` between its spot in `previous` and now, by `alpha`. */
  update(previous: readonly SpawnedObject[], current: readonly SpawnedObject[], alpha: number) {
    const before = new Map(previous.map((object) => [object.id, object]));
    const seen = new Set<number>();
    for (const object of current) {
      seen.add(object.id);
      let mesh = this.meshes.get(object.id);
      if (!mesh) {
        const color = PLAYER_COLORS[object.owner % PLAYER_COLORS.length] ?? 0xffffff;
        mesh = new THREE.Mesh(
          this.geometry,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4),
          }),
        );
        this.meshes.set(object.id, mesh);
        this.scene.add(mesh);
      }
      const from = before.get(object.id)?.position ?? object.position;
      mesh.position.set(
        lerp(from.x, object.position.x, alpha),
        lerp(from.y, object.position.y, alpha),
        0,
      );
      mesh.scale.setScalar(object.radius);
    }
    for (const [id, mesh] of this.meshes) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      mesh.material.dispose();
      this.meshes.delete(id);
    }
  }
}
