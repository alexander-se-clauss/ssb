import { describe, expect, it } from 'vitest';
import { HUMANOID, REST_POSE, boneSegments, vec2 } from '../../core';
import { bodyParts } from './body-layout';

describe('body layout', () => {
  it('places one part per bone, centred between its joints and turned along it', () => {
    const parts = bodyParts(boneSegments(HUMANOID, REST_POSE, vec2(0, 0), 1));
    expect(parts.map((part) => part.bone).sort()).toEqual(
      HUMANOID.bones.map((bone) => bone.id).sort(),
    );
    const torso = parts.find((part) => part.bone === 'torso');
    expect(torso).toMatchObject({ x: 0, length: 0.5, depth: 0 });
    expect(torso?.y).toBeCloseTo(1.05);
    expect(torso?.angle).toBeCloseTo(0);
    // A hanging arm points straight down: half a turn from up.
    expect(Math.abs(parts.find((part) => part.bone === 'upperArmFront')?.angle ?? 0)).toBeCloseTo(
      Math.PI,
    );
  });

  it('puts front limbs in front of the body and back limbs behind it', () => {
    const parts = bodyParts(boneSegments(HUMANOID, REST_POSE, vec2(0, 0), 1));
    const depth = (bone: string) => parts.find((part) => part.bone === bone)?.depth ?? 0;
    expect(depth('upperArmFront')).toBeGreaterThan(0);
    expect(depth('lowerLegFront')).toBeGreaterThan(0);
    expect(depth('upperArmBack')).toBeLessThan(0);
    expect(depth('head')).toBe(0);
  });

  it('turns a forward arm a quarter turn towards +x', () => {
    const reach = boneSegments(HUMANOID, { ...REST_POSE, upperArmFront: 90 }, vec2(0, 0), 1);
    const arm = bodyParts(reach).find((part) => part.bone === 'upperArmFront');
    // Three.js turns counter-clockwise for positive z rotation, so pointing +x is -90 degrees.
    expect(arm?.angle).toBeCloseTo(-Math.PI / 2);
    expect(arm?.x).toBeCloseTo(0.15);
  });
});
