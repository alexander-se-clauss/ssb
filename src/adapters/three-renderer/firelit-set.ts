import * as THREE from 'three';
import type { Pose } from '../../core';
import { fighterModel, poseFighter } from './fighter-model';

/**
 * Pieces of the firelit Kombat set shared by the menu backdrop and character select: stone
 * platforms, ruined pillars against a distant fire, soft glows and showcase fighters.
 */

const canvasTexture = (
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) paint(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** A soft round spot, for glows, smoke and embers. */
export const glowTexture = (): THREE.CanvasTexture =>
  canvasTexture(128, 128, (context) => {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  });

/** Bright at the lamp, fading to nothing at the floor: the texture of a light beam. */
export const beamTexture = (): THREE.CanvasTexture =>
  canvasTexture(4, 256, (context) => {
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 256);
  });

/** A square of additive light, facing the camera unless rotated. */
export const glowPlane = (
  map: THREE.Texture,
  color: number,
  size: number,
  opacity: number,
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> =>
  new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

/** A dark floor, a distant fire and the broken pillars of a ruined hall against its glow. */
export const addRuins = (scene: THREE.Scene, glow: THREE.Texture): void => {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0x0f0c0a, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.3;
  ground.receiveShadow = true;
  scene.add(ground);
  const fire = glowPlane(glow, 0xff5a14, 50, 0.55);
  fire.position.set(0, 3, -30);
  scene.add(fire);
  const stone = new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const height = 5 + ((i * 37) % 9);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, height, 8), stone);
    pillar.position.set(-28 + i * 7, height / 2 - 0.3, -22 - (i % 3) * 3);
    pillar.rotation.z = ((i % 4) - 1.5) * 0.04;
    scene.add(pillar);
  }
};

/** Radius of a platform's top, in scene units. */
export const DAIS_RADIUS = 3.2;
/** Height of a platform's top, where fighters stand. */
export const DAIS_TOP = 0.5;

/** An octagonal stone platform with a rune ring in `rune`'s colour, standing on the origin. */
export const stoneDais = (rune: THREE.Material, radius = DAIS_RADIUS): THREE.Group => {
  const stone = new THREE.MeshStandardMaterial({
    color: 0x2a2420,
    roughness: 0.85,
    metalness: 0.1,
    flatShading: true,
  });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, 0.5, 8), stone);
  top.position.y = 0.25;
  top.castShadow = top.receiveShadow = true;
  const step = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.3, radius * 1.4, 0.35, 8),
    stone,
  );
  step.position.y = -0.15;
  step.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.8, radius * 0.84, 8), rune);
  ring.rotation.set(-Math.PI / 2, 0, Math.PI / 8);
  ring.position.y = DAIS_TOP + 0.01;
  const dais = new THREE.Group();
  dais.add(top, step, ring);
  return dais;
};

/**
 * A character's match body in a pose, with a glossier finish for showcase shots. The holder
 * stands on the origin; `facing` 1 looks right, -1 left.
 */
export const showcaseFighter = (
  characterId: string,
  color: number,
  pose: Pose,
  scale: number,
  facing: 1 | -1,
): THREE.Group => {
  const model = fighterModel(characterId, color);
  poseFighter(model, pose);
  for (const material of model.materials) {
    material.roughness = 0.35;
    material.metalness = 0.55;
    material.transparent = false;
  }
  model.root.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true;
  });
  const holder = new THREE.Group();
  holder.add(model.root);
  holder.scale.set(scale * facing, scale, scale);
  return holder;
};
