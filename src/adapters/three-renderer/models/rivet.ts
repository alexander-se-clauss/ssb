/**
 * Rivet, a stocky handyman in a work cap, overalls and a tool belt, built from primitives on his
 * own short-legged skeleton (`STOCKY`, #39). Every bone gets rigid pieces only, so poses, hurtboxes
 * and moves stay core's.
 * Head and torso point up in their bone space (+x is the facing side); hanging limbs point down,
 * so there the facing side is -x.
 */
import * as THREE from 'three';
import type { BoneDef } from '../../../core';
import type { PartBuilder } from '../fighter-model';
import { ball, capsule, type Material } from './shapes';

const ORANGE = 0xe8822a;
/** The overalls; they take the player's colour in a match (see `fighter-model.ts`). */
export const OVERALLS = 0x2f6f73;
const SKIN = 0xf2c09a;
const WHITE = 0xf7f7f2;
const GLOVE = 0xc9ccd1;
const HAIR = 0x8a3b1a;
const BOOT = 0x34363b;
const SOLE = 0x1f2024;
const STEEL = 0xb8bec6;
const BELT = 0x5a3a22;
const EYE = 0x3d8a4a;

const torso = (m: Material): THREE.Object3D[] => [
  // Orange shirt over the chest and shoulders.
  ball(m(ORANGE), 0.2, [0, 0.12, 0], [0.95, 0.85, 1.15]),
  // Overalls: a round belly that bulges forward, and the seat behind.
  ball(m(OVERALLS), 0.22, [0.02, -0.07, 0], [1, 1, 1.05]),
  ball(m(OVERALLS), 0.2, [0, -0.2, 0], [1, 0.7, 1.05]),
  // Tool belt round the waist, with a steel buckle in front.
  (() => {
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.032, 8, 28), m(BELT));
    belt.position.y = -0.13;
    belt.rotation.x = Math.PI / 2;
    return belt;
  })(),
  (() => {
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.09), m(STEEL));
    buckle.position.set(0.24, -0.13, 0);
    return buckle;
  })(),
  // Bib and straps up the chest, riveted in front.
  ...[-1, 1].flatMap((side) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.06), m(OVERALLS));
    strap.position.set(0, 0.16, side * 0.09);
    strap.rotation.z = Math.PI / 2;
    strap.scale.set(0.62, 1, 1);
    const over = ball(m(OVERALLS), 0.2, [0, 0.12, side * 0.09], [0.99, 0.84, 0.18]);
    return [strap, over, ball(m(STEEL), 0.035, [0.185, 0.07, side * 0.085], [0.6, 1, 1])];
  }),
];

const head = (m: Material): THREE.Object3D[] => {
  const parts: THREE.Object3D[] = [
    ball(m(SKIN), 0.2, [0, -0.01, 0], [1, 0.97, 0.98]),
    // Big round nose and the moustache below it.
    ball(m(SKIN), 0.085, [0.2, -0.03, 0]),
    ball(m(HAIR), 0.1, [0.18, -0.095, 0], [0.5, 0.42, 1.65]),
    // Hair at the back of the head and the sideburns.
    ball(m(HAIR), 0.17, [-0.07, -0.05, 0], [0.85, 0.75, 1.05]),
    ...[-1, 1].flatMap((side) => [
      ball(m(SKIN), 0.05, [-0.01, -0.02, side * 0.195], [0.8, 1.1, 0.5]),
      ball(m(HAIR), 0.04, [0.08, -0.02, side * 0.17], [0.7, 1.2, 0.6]),
      // Eyes: white with a blue iris, looking ahead.
      ball(m(WHITE), 0.05, [0.17, 0.035, side * 0.065], [0.55, 1.25, 0.75]),
      ball(m(EYE), 0.028, [0.192, 0.03, side * 0.062], [0.45, 1.2, 0.8]),
      // Thick dark eyebrows.
      ball(m(HAIR), 0.035, [0.17, 0.1, side * 0.07], [0.5, 0.45, 1.4]),
    ]),
  ];

  // Orange work cap: a dome a little bigger than the head, a brim in front and a nut badge.
  const cap = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    m(ORANGE),
  );
  dome.scale.set(1.08, 1, 1.05);
  cap.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20), m(ORANGE));
  brim.scale.set(1.05, 1, 1.15);
  brim.position.set(0.12, 0.0, 0);
  cap.add(brim);
  // The badge sits on the front of the dome, tilted up with it: a hex nut on a white patch.
  const badge = new THREE.Group();
  badge.add(new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), m(WHITE)));
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 6), m(STEEL));
  nut.rotation.x = Math.PI / 2;
  nut.position.z = 0.006;
  badge.add(nut);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), m(SOLE));
  hole.position.z = 0.013;
  badge.add(hole);
  badge.position.x = 0.228;
  badge.rotation.y = Math.PI / 2;
  const tilt = new THREE.Group();
  tilt.rotation.z = 0.55;
  tilt.add(badge);
  cap.add(tilt);
  cap.position.set(0.01, 0.085, 0);
  cap.rotation.z = -0.12;
  parts.push(cap);
  // Drawn a little smaller than modelled, so cap and face stay close to the head hurtbox.
  const scaled = new THREE.Group();
  scaled.scale.setScalar(0.9);
  scaled.add(...parts);
  return [scaled];
};

// Limbs follow the bone they hang on (#39): Rivet's own body is shorter than the capsule's.
const upperArm = (m: Material, bone: BoneDef): THREE.Object3D[] => [
  capsule(m(ORANGE), bone.radius + 0.005, bone.length + 0.02),
];

const lowerArm = (m: Material, bone: BoneDef): THREE.Object3D[] => {
  const half = bone.length / 2;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.07, 14), m(GLOVE));
  cuff.position.y = half - 0.07;
  return [
    capsule(m(ORANGE), bone.radius + 0.005, bone.length - 0.1, -0.05),
    cuff,
    // A big work-gloved fist.
    ball(m(GLOVE), 0.085, [0, half - 0.01, 0], [1, 1.05, 1]),
  ];
};

const upperLeg = (m: Material, bone: BoneDef): THREE.Object3D[] => [
  capsule(m(OVERALLS), bone.radius + 0.005, bone.length + 0.02),
];

const lowerLeg = (m: Material, bone: BoneDef): THREE.Object3D[] => {
  const half = bone.length / 2;
  return [
    capsule(m(OVERALLS), bone.radius + 0.005, bone.length - 0.06, -0.03),
    // Heavy work boot, longer than wide and pointing the way the fighter faces.
    ball(m(BOOT), 0.11, [-0.06, half - 0.03, 0], [1.6, 0.75, 1.05]),
    ball(m(SOLE), 0.1, [-0.02, half + 0.02, 0], [1.6, 0.3, 1.1]),
  ];
};

/** Torso and head are modelled for a bone of `radius` and `length`; scaled to the actual one. */
const fitted = (
  parts: THREE.Object3D[],
  bone: BoneDef,
  radius: number,
  length: number,
): THREE.Object3D[] => {
  const group = new THREE.Group();
  group.scale.set(bone.radius / radius, bone.length / length, bone.radius / radius);
  group.add(...parts);
  return [group];
};

export const rivetParts: PartBuilder = (bone, material) => {
  switch (bone.id) {
    case 'torso':
      return fitted(torso(material), bone, 0.2, 0.5);
    case 'head':
      return fitted(head(material), bone, 0.17, 0.3);
    case 'upperArmFront':
    case 'upperArmBack':
      return upperArm(material, bone);
    case 'lowerArmFront':
    case 'lowerArmBack':
      return lowerArm(material, bone);
    case 'upperLegFront':
    case 'upperLegBack':
      return upperLeg(material, bone);
    case 'lowerLegFront':
    case 'lowerLegBack':
      return lowerLeg(material, bone);
  }
};
