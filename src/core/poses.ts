/**
 * Which pose a fighter's body shows, and how it gets there. Each movement state has a pose; idle
 * breathes and sways, running swings arms and legs, and the body blends towards the current
 * target a little each frame, so switching states never pops. The pose lives in `FighterState`,
 * so hurtboxes follow it and the view only interpolates and draws it.
 */
import { DODGE, HITSTUN_PER_KNOCKBACK, LEDGE, POSE } from './config';
import { findMove } from './move-data';
import type { MoveDef } from './moves';
import { POSES, type PoseName } from './pose-data';
import { BONE_IDS, type BoneId, type Pose } from './skeleton';
import type { FighterState } from './types';

export { POSES, type PoseName };

/** Hitstun of a launch at `POSE.tumbleSpeed`; longer hitstun means a tumble. */
const TUMBLE_HITSTUN = Math.round(POSE.tumbleSpeed * HITSTUN_PER_KNOCKBACK);

/** The pose for what the fighter is doing right now; `null` while a move's keyframes lead. */
export const poseName = (fighter: FighterState): PoseName | null => {
  switch (fighter.action) {
    case 'run':
      return 'run';
    case 'jumpsquat':
      return 'crouch';
    case 'landing':
      return 'land';
    case 'sidestepIn':
    case 'sidestepOut':
      return 'sidestep';
    case 'forwardRoll':
    case 'backRoll':
      // Tucked while it rolls, then standing up for the recovery, open to a punish.
      return fighter.actionFrame < DODGE.roll.moveTo ? 'roll' : 'idle';
    case 'airDodge':
      return 'airDodge';
    case 'ledge':
      return 'ledge';
    case 'helpless':
      return 'fall';
    case 'ledgeStand':
    case 'ledgeAttack':
      // Pulling up onto the stage, knees tucked.
      return 'crouch';
    case 'ledgeRoll':
      return fighter.actionFrame < LEDGE.getup.roll.climbFrames ||
        fighter.actionFrame >= LEDGE.getup.roll.rollTo
        ? 'crouch'
        : 'roll';
    case 'attack':
      return fighter.moveId === null ? 'idle' : null;
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
 * frame; each fighter breathes at its own phase so they do not move in lockstep. During a move it
 * is the move's keyframe pose (the first one until the body reaches it).
 */
export const targetPose = (fighter: FighterState, frame: number): Pose => {
  const name = poseName(fighter);
  if (name === null && fighter.moveId !== null) {
    const move = findMove(fighter.moveId);
    return movePose(move, Math.max(fighter.actionFrame, move.poses[0]?.frame ?? 0));
  }
  const base = POSES[name ?? 'idle'];
  if (name === 'idle') {
    // A Melee-style bob: the knees flex and the chest rises and falls with each breath.
    const breath = wave(frame + fighter.slot * 37, POSE.idleCycleFrames);
    return {
      ...base,
      torso: base.torso + 3 * breath,
      head: base.head - 2 * breath,
      upperArmFront: base.upperArmFront - 4 * breath,
      upperArmBack: base.upperArmBack - 3 * breath,
      upperLegFront: base.upperLegFront - 4 * breath,
      lowerLegFront: base.lowerLegFront + 8 * breath,
      upperLegBack: base.upperLegBack + 3 * breath,
      lowerLegBack: base.lowerLegBack + 6 * breath,
    };
  }
  if (name === 'run') {
    const stride = wave(fighter.actionFrame, POSE.runCycleFrames);
    return {
      ...base,
      // Long strides: one thigh reaches forward while the other pushes back.
      upperLegFront: base.upperLegFront - 55 * stride,
      upperLegBack: base.upperLegBack + 55 * stride,
      // The swinging leg folds its knee on the way forward.
      lowerLegFront: base.lowerLegFront + 50 * Math.max(0, -stride),
      lowerLegBack: base.lowerLegBack + 50 * Math.max(0, stride),
      // Arms pump against the legs.
      upperArmFront: base.upperArmFront + 25 * stride,
      upperArmBack: base.upperArmBack - 25 * stride,
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

/**
 * A move's pose on one of its frames (ADR 0006): linear between keyframes, held before the first
 * and after the last.
 */
export const movePose = (move: MoveDef, frame: number): Pose => {
  let previous = move.poses[0];
  if (!previous) return POSES.idle;
  for (const key of move.poses) {
    if (key.frame >= frame) {
      if (key.frame === previous.frame) return { ...key.pose };
      const t = (frame - previous.frame) / (key.frame - previous.frame);
      return blendPose(previous.pose, key.pose, Math.max(0, t));
    }
    previous = key;
  }
  return { ...previous.pose };
};

/**
 * One frame of easing towards what the fighter is doing. In a move, the body closes the gap to
 * the first keyframe evenly, arriving exactly on its frame, and then follows the keyframes.
 */
export const nextPose = (fighter: FighterState, frame: number): Pose => {
  if (fighter.action === 'attack' && fighter.moveId !== null) {
    const move = findMove(fighter.moveId);
    const first = move.poses[0];
    if (first && fighter.actionFrame < first.frame) {
      return blendPose(fighter.pose, first.pose, 1 / (first.frame - fighter.actionFrame + 1));
    }
    return movePose(move, fighter.actionFrame);
  }
  return blendPose(fighter.pose, targetPose(fighter, frame), POSE.blend);
};
