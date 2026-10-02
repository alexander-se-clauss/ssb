import * as THREE from 'three';
import { HUMANOID, plantedBoneSegments, vec2, type BoneId, type Pose } from '../../core';
import { bodyParts } from './body-layout';
import { OVERALLS, rivetParts } from './models/rivet';

export const PLAYER_COLORS = [0xe94f4f, 0x4f8fe9, 0x4fd18b, 0xf2c14e] as const;

/** The colour for a fighter that belongs to no player, such as the roster portraits. */
export const NEUTRAL_COLOR = 0xbdcadb;

/**
 * A fighter's look: one group per bone, placed every frame where core says the bone is. Each
 * group's origin is the bone's centre with +y along the bone and +x the way the fighter faces.
 */
export interface FighterModel {
  readonly root: THREE.Group;
  readonly parts: ReadonlyMap<BoneId, THREE.Object3D>;
  /** Every material, so the view can flash and tint the whole body. */
  readonly materials: readonly THREE.MeshStandardMaterial[];
  /** Paints the player's colour (or `NEUTRAL_COLOR` for the character's own) onto the model. */
  readonly tint: (color: number) => void;
}

/** Builds the meshes of one bone in its local space; `material` makes shared, flashable materials. */
export type PartBuilder = (
  bone: (typeof HUMANOID.bones)[number],
  material: (color: number) => THREE.MeshStandardMaterial,
) => THREE.Object3D[];

export interface CharacterLook {
  readonly parts: PartBuilder;
  /** The colour in `parts` that turns into the player's colour, so mirror matches stay readable. */
  readonly playerColor: number;
}

const capsuleParts: PartBuilder = (bone, material) => {
  const geometry =
    bone.shape === 'ball'
      ? new THREE.SphereGeometry(bone.radius, 16, 12)
      : new THREE.CapsuleGeometry(
          bone.radius,
          Math.max(bone.length - bone.radius * 2, 0.01),
          6,
          12,
        );
  const mesh = new THREE.Mesh(geometry, material(NEUTRAL_COLOR));
  if (bone.id !== 'head') return [mesh];
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), material(0xffffff));
  eye.position.set(0.12, 0.03, 0.08);
  return [mesh, eye];
};

const CAPSULE_LOOK: CharacterLook = { parts: capsuleParts, playerColor: NEUTRAL_COLOR };

/** Each registry character's look, by id; unknown ids fall back to the capsule. */
export const CHARACTER_LOOKS: Readonly<Record<string, CharacterLook>> = {
  capsule: CAPSULE_LOOK,
  rivet: { parts: rivetParts, playerColor: OVERALLS },
};

/** Far-side limbs are drawn darker so the near ones read in front. */
const FAR_SHADE = 0.65;

/** The actual match body of a character, shared by gameplay, lobby portraits and the podium. */
export const fighterModel = (characterId: string, color: number): FighterModel => {
  const look = CHARACTER_LOOKS[characterId] ?? CAPSULE_LOOK;
  const materials: THREE.MeshStandardMaterial[] = [];
  const playerMaterials: { material: THREE.MeshStandardMaterial; shade: number }[] = [];
  const root = new THREE.Group();
  const parts = new Map<BoneId, THREE.Object3D>();
  for (const bone of HUMANOID.bones) {
    const shade = bone.id.endsWith('Back') ? FAR_SHADE : 1;
    const cache = new Map<number, THREE.MeshStandardMaterial>();
    const material = (base: number) => {
      let made = cache.get(base);
      if (!made) {
        made = new THREE.MeshStandardMaterial({ color: base, roughness: 0.5, transparent: true });
        made.color.multiplyScalar(shade);
        cache.set(base, made);
        materials.push(made);
        if (base === look.playerColor) playerMaterials.push({ material: made, shade });
      }
      return made;
    };
    const group = new THREE.Group();
    for (const mesh of look.parts(bone, material)) {
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) child.castShadow = true;
      });
      group.add(mesh);
    }
    parts.set(bone.id, group);
    root.add(group);
  }
  const tint = (next: number) => {
    const target = next === NEUTRAL_COLOR ? look.playerColor : next;
    for (const { material, shade } of playerMaterials) {
      material.color.setHex(target).multiplyScalar(shade);
    }
  };
  tint(color);
  return { root, parts, materials, tint };
};

export const poseFighter = (model: FighterModel, pose: Pose): void => {
  for (const part of bodyParts(plantedBoneSegments(HUMANOID, pose, vec2(0, 0), 1))) {
    const group = model.parts.get(part.bone);
    if (!group) continue;
    group.position.set(part.x, part.y, part.depth);
    group.rotation.z = part.angle;
  }
};
