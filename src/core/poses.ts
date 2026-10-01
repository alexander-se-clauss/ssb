/**
 * Which pose a fighter's body shows, and how it gets there. Each movement state has a pose; idle
 * breathes and sways, running swings arms and legs, and the body blends towards the current
 * target a little each frame, so switching states never pops. The pose lives in `FighterState`,
 * so hurtboxes follow it and the view only interpolates and draws it.
 */
import { HITSTUN_PER_KNOCKBACK, POSE } from './config';
import { BONE_IDS, type BoneId, type Pose } from './skeleton';
import type { FighterState } from './types';

export type PoseName = 'idle' | 'run' | 'jump' | 'fall' | 'jab' | 'hurt' | 'tumble';

/**
 * Melee-style key poses. Angles are relative to the parent bone (0 = straight on, positive turns
 * towards the facing direction); for a bone on the hip, 0 points up, 90 forward and 180 down.
 * Knees bend forward, so a shin turns further back than its thigh.
 */
export const POSES: Readonly<Record<PoseName, Pose>> = {
  // Fighting stance: low and leaning in, fists up in front, feet apart.
  idle: {
    torso: 18,
    head: -12,
    upperArmFront: 122,
    lowerArmFront: -90,
    upperArmBack: 150,
    lowerArmBack: -95,
    upperLegFront: 150,
    lowerLegFront: 45,
    upperLegBack: 200,
    lowerLegBack: 25,
  },
  // Dash: leaning hard into the run, arms swept back.
  run: {
    torso: 38,
    head: -28,
    upperArmFront: 197,
    lowerArmFront: 40,
    upperArmBack: 177,
    lowerArmBack: 30,
    upperLegFront: 175,
    lowerLegFront: 35,
    upperLegBack: 185,
    lowerLegBack: 35,
  },
  // Rising: knees tucked up to the chest, fists pulled in.
  jump: {
    torso: 20,
    head: -10,
    upperArmFront: 125,
    lowerArmFront: -105,
    upperArmBack: 205,
    lowerArmBack: -70,
    upperLegFront: 85,
    lowerLegFront: 120,
    upperLegBack: 125,
    lowerLegBack: 110,
  },
  // Falling: arms loosely raised for balance, legs apart and ready to land.
  fall: {
    torso: 10,
    head: -5,
    upperArmFront: 135,
    lowerArmFront: -45,
    upperArmBack: 215,
    lowerArmBack: -35,
    upperLegFront: 160,
    lowerLegFront: 35,
    upperLegBack: 195,
    lowerLegBack: 30,
  },
  // Jab: front fist straight out, back fist guarding, stepping in.
  jab: {
    torso: 25,
    head: -15,
    upperArmFront: 60,
    lowerArmFront: 0,
    upperArmBack: 135,
    lowerArmBack: -100,
    upperLegFront: 140,
    lowerLegFront: 50,
    upperLegBack: 205,
    lowerLegBack: 20,
  },
  // Flinch: head and chest snap back, the arms trail behind the body.
  hurt: {
    torso: -20,
    head: -25,
    upperArmFront: 125,
    lowerArmFront: 35,
    upperArmBack: 150,
    lowerArmBack: 30,
    upperLegFront: 160,
    lowerLegFront: 40,
    upperLegBack: 200,
    lowerLegBack: 30,
  },
  // Launched: thrown back, limbs flung wide.
  tumble: {
    torso: -80,
    head: -30,
    upperArmFront: 110,
    lowerArmFront: 10,
    upperArmBack: -80,
    lowerArmBack: -10,
    upperLegFront: 120,
    lowerLegFront: 40,
    upperLegBack: 240,
    lowerLegBack: -30,
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

/** One frame of easing towards what the fighter is doing. */
export const nextPose = (fighter: FighterState, frame: number): Pose =>
  blendPose(fighter.pose, targetPose(fighter, frame), POSE.blend);
