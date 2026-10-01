import { describe, expect, it } from 'vitest';
import { FIGHTER } from './config';
import { vec2, type Vec2 } from './math';
import { HUMANOID, REST_POSE, boneSegments, type Pose } from './skeleton';

const expectNear = (actual: Vec2 | undefined, expected: Vec2): void => {
  expect(actual?.x).toBeCloseTo(expected.x, 6);
  expect(actual?.y).toBeCloseTo(expected.y, 6);
};

describe('fighter skeleton', () => {
  it('stands as tall as the fighter in the rest pose', () => {
    const bones = boneSegments(HUMANOID, REST_POSE, vec2(0, 0), 1);
    expectNear(bones.head.end, vec2(0, FIGHTER.height));
    expectNear(bones.lowerLegFront.end, vec2(0, 0));
    expectNear(bones.lowerLegBack.end, vec2(0, 0));
  });

  it('gives every bone a start and end joint in world space for a known pose', () => {
    const bones = boneSegments(HUMANOID, REST_POSE, vec2(2, 1), 1);
    // Hips sit on top of the legs, shoulders on top of the torso.
    expectNear(bones.torso.start, vec2(2, 1.8));
    expectNear(bones.torso.end, vec2(2, 2.3));
    expectNear(bones.head.start, vec2(2, 2.3));
    // Arms hang from the shoulders, legs from the hips.
    expectNear(bones.upperArmFront.start, vec2(2, 2.3));
    expectNear(bones.upperArmFront.end, vec2(2, 2));
    expectNear(bones.lowerArmFront.end, vec2(2, 1.7));
    expectNear(bones.upperLegBack.start, vec2(2, 1.8));
    expectNear(bones.upperLegBack.end, vec2(2, 1.4));
    expect(Object.keys(bones).sort()).toEqual(HUMANOID.bones.map((bone) => bone.id).sort());
  });

  it('turns angles towards the facing direction, relative to the parent bone', () => {
    // The front arm points straight forward: 90 degrees up from hanging.
    const reach: Pose = { ...REST_POSE, upperArmFront: 90 };
    const right = boneSegments(HUMANOID, reach, vec2(0, 0), 1);
    expectNear(right.upperArmFront.end, vec2(0.3, 1.3));
    expectNear(right.lowerArmFront.end, vec2(0.6, 1.3));
    const left = boneSegments(HUMANOID, reach, vec2(0, 0), -1);
    expectNear(left.lowerArmFront.end, vec2(-0.6, 1.3));
  });

  it('carries children along when a parent bone rotates', () => {
    // Leaning the torso 30 degrees forward moves the shoulders, head and arms with it.
    const lean: Pose = { ...REST_POSE, torso: 30 };
    const bones = boneSegments(HUMANOID, lean, vec2(0, 0), 1);
    const sin = Math.sin(Math.PI / 6);
    const cos = Math.cos(Math.PI / 6);
    const shoulder = vec2(0.5 * sin, 0.8 + 0.5 * cos);
    expectNear(bones.torso.end, shoulder);
    expectNear(bones.head.end, vec2(0.8 * sin, 0.8 + 0.8 * cos));
    // The hanging arm stays 180 degrees from the torso, so it points down and back.
    expectNear(bones.lowerArmFront.end, vec2(shoulder.x - 0.6 * sin, shoulder.y - 0.6 * cos));
    // Legs hang from the hip, not from the torso, so they stay put.
    expectNear(bones.lowerLegFront.end, vec2(0, 0));
  });

  it('bends a joint in the middle of a limb', () => {
    // A knee bent 90 degrees backwards puts the foot behind the knee.
    const kneel: Pose = { ...REST_POSE, lowerLegBack: 90 };
    const bones = boneSegments(HUMANOID, kneel, vec2(0, 0), 1);
    expectNear(bones.upperLegBack.end, vec2(0, 0.4));
    expectNear(bones.lowerLegBack.end, vec2(-0.4, 0.4));
  });

  it('refuses a skeleton that misses a bone or lists a child before its parent', () => {
    const missing = { ...HUMANOID, bones: HUMANOID.bones.filter((bone) => bone.id !== 'head') };
    expect(() => boneSegments(missing, REST_POSE, vec2(0, 0), 1)).toThrow(/head/);
    const reversed = { ...HUMANOID, bones: [...HUMANOID.bones].reverse() };
    expect(() => boneSegments(reversed, REST_POSE, vec2(0, 0), 1)).toThrow(/parent/);
  });

  it('is plain data, so it can live in definitions and match state', () => {
    expect(JSON.parse(JSON.stringify(HUMANOID))).toEqual(HUMANOID);
    expect(JSON.parse(JSON.stringify(REST_POSE))).toEqual(REST_POSE);
  });
});
