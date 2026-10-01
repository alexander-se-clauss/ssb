/**
 * A fighter's body as plain data: bones with lengths and parents, and poses as joint angles.
 * Gameplay happens on a 2D plane, so the skeleton is 2D too; the view adds depth. Core turns a
 * pose into world positions (`boneSegments`), so hurtboxes and hitboxes can follow the bones.
 */
import type { Vec2 } from './math';

export type BoneId =
  | 'torso'
  | 'head'
  | 'upperArmFront'
  | 'lowerArmFront'
  | 'upperArmBack'
  | 'lowerArmBack'
  | 'upperLegFront'
  | 'lowerLegFront'
  | 'upperLegBack'
  | 'lowerLegBack';

export interface BoneDef {
  readonly id: BoneId;
  /** The bone this one hangs from; `null` hangs it from the hip. */
  readonly parent: BoneId | null;
  /** Where on the parent it attaches: its start joint or its end joint. Unused on the hip. */
  readonly attach: 'start' | 'end';
  readonly length: number;
}

export interface SkeletonDef {
  /** Height of the hip above the feet when standing. */
  readonly hipHeight: number;
  /** Every bone exactly once, parents before their children. */
  readonly bones: readonly BoneDef[];
}

/**
 * Joint angles in degrees, each relative to the parent bone's direction (or straight up for a
 * bone on the hip). Positive angles turn towards the way the fighter faces.
 */
export type Pose = Readonly<Record<BoneId, number>>;

/** Every bone id, in a fixed order, for code that walks a whole pose. */
export const BONE_IDS: readonly BoneId[] = [
  'torso',
  'head',
  'upperArmFront',
  'lowerArmFront',
  'upperArmBack',
  'lowerArmBack',
  'upperLegFront',
  'lowerLegFront',
  'upperLegBack',
  'lowerLegBack',
];

/** A bone's two joints in world space. */
export interface BoneSegment {
  readonly start: Vec2;
  readonly end: Vec2;
}

/** Head, torso, two-part arms and legs; stands `FIGHTER.height` tall in the rest pose. */
export const HUMANOID: SkeletonDef = {
  hipHeight: 0.8,
  bones: [
    { id: 'torso', parent: null, attach: 'start', length: 0.5 },
    { id: 'head', parent: 'torso', attach: 'end', length: 0.3 },
    { id: 'upperArmFront', parent: 'torso', attach: 'end', length: 0.3 },
    { id: 'lowerArmFront', parent: 'upperArmFront', attach: 'end', length: 0.3 },
    { id: 'upperArmBack', parent: 'torso', attach: 'end', length: 0.3 },
    { id: 'lowerArmBack', parent: 'upperArmBack', attach: 'end', length: 0.3 },
    { id: 'upperLegFront', parent: null, attach: 'start', length: 0.4 },
    { id: 'lowerLegFront', parent: 'upperLegFront', attach: 'end', length: 0.4 },
    { id: 'upperLegBack', parent: null, attach: 'start', length: 0.4 },
    { id: 'lowerLegBack', parent: 'upperLegBack', attach: 'end', length: 0.4 },
  ],
};

/** Standing straight, arms and legs hanging down. */
export const REST_POSE: Pose = {
  torso: 0,
  head: 0,
  upperArmFront: 180,
  lowerArmFront: 0,
  upperArmBack: 180,
  lowerArmBack: 0,
  upperLegFront: 180,
  lowerLegFront: 0,
  upperLegBack: 180,
  lowerLegBack: 0,
};

/**
 * World positions of every bone for a pose, with the feet at `position`. Angles add up from
 * parent to child (forward kinematics); `facing` mirrors the result for a fighter facing left.
 */
export const boneSegments = (
  skeleton: SkeletonDef,
  pose: Pose,
  position: Vec2,
  facing: 1 | -1,
): Record<BoneId, BoneSegment> => {
  const hip: Vec2 = { x: position.x, y: position.y + skeleton.hipHeight };
  const segments: Partial<Record<BoneId, BoneSegment>> = {};
  const angles: Partial<Record<BoneId, number>> = {};
  for (const bone of skeleton.bones) {
    if (segments[bone.id]) throw new Error(`Bone ${bone.id} is listed twice`);
    const parent = bone.parent === null ? undefined : segments[bone.parent];
    if (bone.parent !== null && !parent) {
      throw new Error(`Bone ${bone.id} is listed before its parent ${bone.parent}`);
    }
    const parentAngle = bone.parent === null ? 0 : (angles[bone.parent] ?? 0);
    const start = parent ? parent[bone.attach] : hip;
    const angle = parentAngle + pose[bone.id];
    const radians = (angle * Math.PI) / 180;
    angles[bone.id] = angle;
    segments[bone.id] = {
      start,
      end: {
        x: start.x + Math.sin(radians) * bone.length * facing,
        y: start.y + Math.cos(radians) * bone.length,
      },
    };
  }
  const missing = Object.keys(pose).filter((id) => !(id in segments));
  if (missing.length > 0) throw new Error(`Skeleton has no bone for ${missing.join(', ')}`);
  // Every bone the pose names is filled in, and a pose names every BoneId.
  return segments as Record<BoneId, BoneSegment>;
};

/** The joints a body stands on. */
const FEET: readonly BoneId[] = ['lowerLegFront', 'lowerLegBack'];

/**
 * Like `boneSegments`, but with the lower foot resting at `position.y`: a crouch lowers the body
 * instead of lifting the feet off the ground. Only the feet anchor it, so a low fist or a head
 * in a tumble does not make the body bob. The view draws this; bone hurtboxes and hitboxes
 * must use it too, so they match what players see.
 */
export const plantedBoneSegments = (
  skeleton: SkeletonDef,
  pose: Pose,
  position: Vec2,
  facing: 1 | -1,
): Record<BoneId, BoneSegment> => {
  const segments = boneSegments(skeleton, pose, position, facing);
  const lowest = Math.min(...FEET.map((bone) => segments[bone].end.y));
  const drop = lowest - position.y;
  const planted: Partial<Record<BoneId, BoneSegment>> = {};
  for (const bone of BONE_IDS) {
    const { start, end } = segments[bone];
    planted[bone] = {
      start: { x: start.x, y: start.y - drop },
      end: { x: end.x, y: end.y - drop },
    };
  }
  // BONE_IDS lists every bone, so every one is filled in.
  return planted as Record<BoneId, BoneSegment>;
};
