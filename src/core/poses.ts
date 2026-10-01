/**
 * Which pose a fighter's body shows, and how it gets there. Each movement state has a pose; idle
 * breathes and sways, running swings arms and legs, and the body blends towards the current
 * target a little each frame, so switching states never pops. The pose lives in `FighterState`,
 * so hurtboxes can follow it later and the view only interpolates and draws it.
 */
import { HITSTUN_PER_KNOCKBACK, POSE } from './config';
import { BONE_IDS, REST_POSE, type BoneId, type Pose } from './skeleton';
import type { FighterState } from './types';

export type PoseName = 'idle' | 'run' | 'jump' | 'fall' | 'jab' | 'hurt' | 'tumble';

/** Arms relax a little away from the body; 180 hangs straight down. */
export const POSES: Readonly<Record<PoseName, Pose>> = {
  idle: {
    ...REST_POSE,
    torso: 4,
    upperArmFront: 165,
    lowerArmFront: 20,
    upperArmBack: 195,
    lowerArmBack: 15,
    upperLegFront: 172,
    lowerLegFront: -6,
    upperLegBack: 190,
    lowerLegBack: -4,
  },
  run: {
    ...REST_POSE,
    torso: 14,
    head: -8,
    upperArmFront: 180,
    lowerArmFront: 70,
    upperArmBack: 180,
    lowerArmBack: 70,
    lowerLegFront: -30,
    lowerLegBack: -30,
  },
  jump: {
    ...REST_POSE,
    torso: 6,
    upperArmFront: 140,
    lowerArmFront: 30,
    upperArmBack: 215,
    lowerArmBack: 20,
    upperLegFront: 130,
    lowerLegFront: -90,
    upperLegBack: 165,
    lowerLegBack: -60,
  },
  fall: {
    ...REST_POSE,
    torso: -4,
    upperArmFront: 120,
    lowerArmFront: -20,
    upperArmBack: 240,
    lowerArmBack: 20,
    upperLegFront: 165,
    lowerLegFront: -20,
    upperLegBack: 195,
    lowerLegBack: -15,
  },
  jab: {
    ...REST_POSE,
    torso: 12,
    upperArmFront: 90,
    lowerArmFront: 0,
    upperArmBack: 210,
    lowerArmBack: 60,
    upperLegFront: 160,
    lowerLegFront: -15,
    upperLegBack: 200,
    lowerLegBack: -10,
  },
  hurt: {
    ...REST_POSE,
    torso: -22,
    head: -15,
    upperArmFront: 130,
    lowerArmFront: 40,
    upperArmBack: 230,
    lowerArmBack: 30,
    upperLegFront: 165,
    lowerLegFront: -25,
    upperLegBack: 200,
    lowerLegBack: -20,
  },
  tumble: {
    ...REST_POSE,
    torso: -50,
    head: -25,
    upperArmFront: 80,
    lowerArmFront: 30,
    upperArmBack: 280,
    lowerArmBack: -30,
    upperLegFront: 140,
    lowerLegFront: -60,
    upperLegBack: 230,
    lowerLegBack: -40,
  },
};

/** Hitstun of a launch at `POSE.tumbleSpeed`; longer hitstun means a tumble. */
const TUMBLE_HITSTUN = Math.round(POSE.tumbleSpeed * HITSTUN_PER_KNOCKBACK);

/** The pose for what the fighter is doing right now. */
export const poseName = (fighter: FighterState): PoseName => {
  switch (fighter.action) {
    case 'run':
      return 'run';
    case 'jab':
      return 'jab';
    case 'airborne':
      return fighter.velocity.y > 0 ? 'jump' : 'fall';
    case 'hitstun':
      // Decided by the launch, not the current speed, so a tumble stays a tumble as it slows:
      // hitstun is set from the launch speed and counts down as `actionFrame` counts up.
      return fighter.hitstunFrames + fighter.actionFrame >= TUMBLE_HITSTUN ? 'tumble' : 'hurt';
    case 'idle':
    case 'eliminated':
      return 'idle';
  }
};

const wave = (frame: number, cycleFrames: number): number =>
  Math.sin((2 * Math.PI * frame) / cycleFrames);

/**
 * The pose the body is heading for: the state's pose plus its motion. `frame` is the match
 * frame; each fighter breathes at its own phase so they do not move in lockstep.
 */
export const targetPose = (fighter: FighterState, frame: number): Pose => {
  const name = poseName(fighter);
  const base = POSES[name];
  if (name === 'idle') {
    const breath = wave(frame + fighter.slot * 37, POSE.idleCycleFrames);
    return {
      ...base,
      torso: base.torso + 2.5 * breath,
      head: base.head - 2 * breath,
      upperArmFront: base.upperArmFront - 5 * breath,
      upperArmBack: base.upperArmBack + 4 * breath,
      lowerArmFront: base.lowerArmFront + 4 * breath,
    };
  }
  if (name === 'run') {
    const stride = wave(fighter.actionFrame, POSE.runCycleFrames);
    return {
      ...base,
      upperLegFront: base.upperLegFront - 35 * stride,
      upperLegBack: base.upperLegBack + 35 * stride,
      lowerLegFront: base.lowerLegFront - 25 * Math.max(0, stride),
      lowerLegBack: base.lowerLegBack - 25 * Math.max(0, -stride),
      // Arms swing against the legs.
      upperArmFront: base.upperArmFront + 30 * stride,
      upperArmBack: base.upperArmBack - 30 * stride,
    };
  }
  return base;
};

/** The angle difference from `from` to `to`, the short way round: -180..180. */
export const shortestTurn = (from: number, to: number): number => {
  const diff = (((to - from) % 360) + 540) % 360;
  return diff - 180;
};

/** The same angle in -180 (exclusive) .. 180 (inclusive), so poses stay comparable. */
const wrapAngle = (angle: number): number => angle - 360 * Math.ceil((angle - 180) / 360);

/** Moves every joint `t` (0..1) of the way from one pose to another, the short way round. */
export const blendPose = (from: Pose, to: Pose, t: number): Pose => {
  const blended: Partial<Record<BoneId, number>> = {};
  for (const bone of BONE_IDS) {
    blended[bone] = wrapAngle(from[bone] + shortestTurn(from[bone], to[bone]) * t);
  }
  // BONE_IDS lists every bone, so every joint is filled in.
  return blended as Pose;
};

/** One frame of easing towards what the fighter is doing. */
export const nextPose = (fighter: FighterState, frame: number): Pose =>
  blendPose(fighter.pose, targetPose(fighter, frame), POSE.blend);
