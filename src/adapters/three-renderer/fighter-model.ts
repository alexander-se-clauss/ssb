import * as THREE from 'three';
import { HUMANOID, plantedBoneSegments, vec2, type BoneId, type Pose } from '../../core';
import { bodyParts } from './body-layout';

export const PLAYER_COLORS = [0xe94f4f, 0x4f8fe9, 0x4fd18b, 0xf2c14e] as const;

/** The actual match body, shared by gameplay, lobby portraits and the results podium. */
export const fighterModel = (color: number) => {
  const near = new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true });
  const far = near.clone();
  far.color.multiplyScalar(0.65);
  const root = new THREE.Group();
  const parts = new Map<BoneId, THREE.Mesh>();
  for (const bone of HUMANOID.bones) {
    const geometry =
      bone.shape === 'ball'
        ? new THREE.SphereGeometry(bone.radius, 16, 12)
        : new THREE.CapsuleGeometry(
            bone.radius,
            Math.max(bone.length - bone.radius * 2, 0.01),
            6,
            12,
          );
    const mesh = new THREE.Mesh(geometry, bone.id.endsWith('Back') ? far : near);
    mesh.castShadow = true;
    parts.set(bone.id, mesh);
    root.add(mesh);
  }
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  eye.position.set(0.12, 0.03, 0.08);
  parts.get('head')?.add(eye);
  return { root, parts, materials: [near, far] };
};

export const poseFighter = (model: ReturnType<typeof fighterModel>, pose: Pose): void => {
  for (const part of bodyParts(plantedBoneSegments(HUMANOID, pose, vec2(0, 0), 1))) {
    const mesh = model.parts.get(part.bone);
    if (!mesh) continue;
    mesh.position.set(part.x, part.y, part.depth);
    mesh.rotation.z = part.angle;
  }
};
