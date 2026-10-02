/**
 * Small primitive helpers shared by the character looks. Positions are in a bone's own space:
 * origin at the bone's centre, +y along the bone (see `PartBuilder`).
 */
import * as THREE from 'three';

/** Makes (or reuses) the body material of one colour; see `PartBuilder`. */
export type Material = (color: number) => THREE.MeshStandardMaterial;

export type Triple = readonly [number, number, number];

/** A sphere, optionally squashed into an ellipsoid. */
export const ball = (
  material: THREE.Material,
  radius: number,
  [x, y, z]: Triple,
  [sx, sy, sz]: Triple = [1, 1, 1],
): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
};

/** A capsule along the bone, `length` long including its round ends, centred at `y`. */
export const capsule = (
  material: THREE.Material,
  radius: number,
  length: number,
  y = 0,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, 0.01), 6, 14),
    material,
  );
  mesh.position.y = y;
  return mesh;
};
