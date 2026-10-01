/**
 * Where to draw each body part, from the bone positions core computed. Kept free of Three.js so it
 * can be tested on its own; `ThreeView` turns each part into a mesh.
 */
import type { BoneId, BoneSegment } from '../../core';

export interface BodyPart {
  readonly bone: BoneId;
  /** Centre between the bone's joints, in the fighter's own space (feet at the origin). */
  readonly x: number;
  readonly y: number;
  /** Rotation about z that turns an upright shape (along +y) onto the bone. */
  readonly angle: number;
  readonly length: number;
  /** Front limbs in front of the body, back limbs behind it; gameplay ignores depth. */
  readonly depth: number;
}

const LIMB_DEPTH = 0.18;

const depthOf = (bone: BoneId): number =>
  bone.endsWith('Front') ? LIMB_DEPTH : bone.endsWith('Back') ? -LIMB_DEPTH : 0;

export const bodyParts = (segments: Readonly<Record<BoneId, BoneSegment>>): BodyPart[] =>
  (Object.entries(segments) as [BoneId, BoneSegment][]).map(([bone, { start, end }]) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return {
      bone,
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      angle: Math.atan2(-dx, dy),
      length: Math.hypot(dx, dy),
      depth: depthOf(bone),
    };
  });
