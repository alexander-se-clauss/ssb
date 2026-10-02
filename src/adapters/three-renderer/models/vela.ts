/**
 * Vela, a bounty hunter in pearl-white power armour with big round shoulder pads, an amber visor
 * and an arm cannon on her front arm, built from primitives on the shared humanoid skeleton.
 * Head and torso point up in their bone space (+x is the facing side); hanging limbs point down,
 * so there the facing side is -x and the hand or foot is at +y.
 */
import * as THREE from 'three';
import type { PartBuilder } from '../fighter-model';
import { ball, capsule, type Material } from './shapes';

/** Shoulder pads, hip plate, helmet stripe and ear pieces; they take the player's colour. */
export const PLATES = 0x5b46c8;
const ARMOUR = 0xe6eaf0;
const UNDERSUIT = 0x3a4150;
const VISOR = 0xffa62b;
const GLOW = 0x3fe3d2;
const MUZZLE = 0x15181e;

const torso = (m: Material): THREE.Object3D[] => {
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), m(GLOW));
  gem.position.set(0.19, 0.1, 0);
  gem.scale.set(0.5, 1, 1);
  return [
    // Breastplate over a slim armoured waist, and a hip plate below.
    ball(m(ARMOUR), 0.2, [0.01, 0.1, 0], [0.95, 0.85, 1.1]),
    capsule(m(UNDERSUIT), 0.13, 0.3, -0.08),
    ball(m(PLATES), 0.17, [0, -0.21, 0], [1, 0.45, 1.05]),
    // A ridge down the back of the armour and a glowing gem on the chest.
    ball(m(UNDERSUIT), 0.12, [-0.12, 0.08, 0], [0.5, 1.2, 0.6]),
    gem,
  ];
};

const head = (m: Material): THREE.Object3D[] => {
  return [
    // Round helmet, a wide visor in front and ear pieces on both sides.
    ball(m(ARMOUR), 0.17, [-0.01, 0.01, 0], [1.05, 1.02, 1]),
    ball(m(VISOR), 0.13, [0.115, 0.005, 0], [0.6, 0.62, 1.0]),
    ball(m(UNDERSUIT), 0.07, [0.1, -0.11, 0], [0.9, 0.5, 1.2]),
    // A raised stripe over the top of the helmet.
    ball(m(PLATES), 0.17, [-0.015, 0.02, 0], [1.04, 1.02, 0.3]),
    ...[-1, 1].map((side) => {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), m(PLATES));
      ear.rotation.x = Math.PI / 2;
      ear.position.set(-0.01, 0.0, side * 0.165);
      return ear;
    }),
  ];
};

const upperArm = (m: Material): THREE.Object3D[] => [
  capsule(m(UNDERSUIT), 0.07, 0.3),
  // The big round shoulder pad sits on the shoulder joint, at the start of the bone.
  ball(m(PLATES), 0.13, [0, -0.11, 0], [1.05, 0.9, 1.1]),
  ball(m(GLOW), 0.025, [-0.1, -0.06, 0]),
];

/** The front arm ends in a cannon instead of a hand, the muzzle where the fist would be. */
const cannon = (m: Material): THREE.Object3D[] => {
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.072, 0.3, 18), m(ARMOUR));
  barrel.position.y = 0.04;
  const rings = [-0.04, 0.08].map((y) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.01, 8, 20), m(GLOW));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    return ring;
  });
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), m(MUZZLE));
  muzzle.position.y = 0.195;
  return [barrel, ...rings, muzzle, ball(m(UNDERSUIT), 0.07, [0, -0.11, 0])];
};

const lowerArm = (m: Material): THREE.Object3D[] => [
  capsule(m(ARMOUR), 0.07, 0.24, -0.03),
  ball(m(UNDERSUIT), 0.07, [0, 0.14, 0]),
];

const upperLeg = (m: Material): THREE.Object3D[] => [
  capsule(m(ARMOUR), 0.1, 0.4),
  // Knee guard at the end of the thigh.
  ball(m(UNDERSUIT), 0.075, [-0.03, 0.19, 0], [0.9, 1, 1.1]),
];

const lowerLeg = (m: Material): THREE.Object3D[] => {
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 10), m(ARMOUR));
  fin.position.set(0.08, 0.08, 0);
  fin.rotation.z = Math.PI * 0.85;
  return [
    capsule(m(ARMOUR), 0.09, 0.34, -0.03),
    // Armoured boot pointing the way the fighter faces, with a fin at the heel.
    ball(m(UNDERSUIT), 0.1, [-0.05, 0.18, 0], [1.6, 0.7, 1.05]),
    ball(m(GLOW), 0.02, [-0.1, 0.0, 0]),
    fin,
  ];
};

export const velaParts: PartBuilder = (bone, material) => {
  switch (bone.id) {
    case 'torso':
      return torso(material);
    case 'head':
      return head(material);
    case 'upperArmFront':
    case 'upperArmBack':
      return upperArm(material);
    case 'lowerArmFront':
      return cannon(material);
    case 'lowerArmBack':
      return lowerArm(material);
    case 'upperLegFront':
    case 'upperLegBack':
      return upperLeg(material);
    case 'lowerLegFront':
    case 'lowerLegBack':
      return lowerLeg(material);
  }
};
