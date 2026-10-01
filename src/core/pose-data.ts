/**
 * The key poses as data: one per movement state, and the ones moves use for their keyframes
 * (ADR 0006). Kept apart from `poses.ts`, so move data can use them without an import cycle.
 */
import type { Pose } from './skeleton';

export type PoseName =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'jab'
  | 'jab2'
  | 'jab3'
  | 'kickChamber'
  | 'forwardTilt'
  | 'upTiltStart'
  | 'upTilt'
  | 'upTiltEnd'
  | 'crouch'
  | 'downTilt'
  | 'forwardSmashWindup'
  | 'forwardSmash'
  | 'upSmashWindup'
  | 'upSmash'
  | 'upSmashEnd'
  | 'downSmashWindup'
  | 'downSmash'
  | 'hurt'
  | 'tumble';

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
  // Jab 2: the back fist follows through, the front fist pulls back to guard.
  jab2: {
    torso: 32,
    head: -18,
    upperArmFront: 140,
    lowerArmFront: -105,
    upperArmBack: 62,
    lowerArmBack: 0,
    upperLegFront: 140,
    lowerLegFront: 50,
    upperLegBack: 205,
    lowerLegBack: 20,
  },
  // Jab 3: a front kick at hip height, leaning back over the standing leg, fists up.
  jab3: {
    torso: -10,
    head: 5,
    upperArmFront: 120,
    lowerArmFront: -95,
    upperArmBack: 160,
    lowerArmBack: -90,
    upperLegFront: 85,
    lowerLegFront: 0,
    upperLegBack: 185,
    lowerLegBack: 5,
  },
  // Forward tilt wind-up: the front knee pulled up to the chest, ready to kick.
  kickChamber: {
    torso: 0,
    head: -5,
    upperArmFront: 125,
    lowerArmFront: -95,
    upperArmBack: 165,
    lowerArmBack: -85,
    upperLegFront: 70,
    lowerLegFront: 110,
    upperLegBack: 190,
    lowerLegBack: 15,
  },
  // Forward tilt: a straight side kick at chest height, leaning back over the standing leg.
  forwardTilt: {
    torso: -15,
    head: 10,
    upperArmFront: 135,
    lowerArmFront: -95,
    upperArmBack: 175,
    lowerArmBack: -80,
    upperLegFront: 80,
    lowerLegFront: 0,
    upperLegBack: 195,
    lowerLegBack: 10,
  },
  // Up tilt, three keys: the leg swings from a low front kick over the head and behind it.
  upTiltStart: {
    torso: -10,
    head: 5,
    upperArmFront: 125,
    lowerArmFront: -95,
    upperArmBack: 165,
    lowerArmBack: -85,
    upperLegFront: 100,
    lowerLegFront: 10,
    upperLegBack: 185,
    lowerLegBack: 10,
  },
  upTilt: {
    torso: -30,
    head: 20,
    upperArmFront: 150,
    lowerArmFront: -60,
    upperArmBack: 200,
    lowerArmBack: -40,
    upperLegFront: 20,
    lowerLegFront: 0,
    upperLegBack: 185,
    lowerLegBack: 5,
  },
  upTiltEnd: {
    torso: -35,
    head: 25,
    upperArmFront: 150,
    lowerArmFront: -60,
    upperArmBack: 200,
    lowerArmBack: -40,
    upperLegFront: -25,
    lowerLegFront: 10,
    upperLegBack: 185,
    lowerLegBack: 5,
  },
  // Crouch: down on the back knee, chest forward, hands low.
  crouch: {
    torso: 45,
    head: -35,
    upperArmFront: 105,
    lowerArmFront: -60,
    upperArmBack: 120,
    lowerArmBack: -70,
    upperLegFront: 130,
    lowerLegFront: 130,
    upperLegBack: 150,
    lowerLegBack: 110,
  },
  // Down tilt: from the crouch, the front leg sweeps out low along the floor.
  downTilt: {
    torso: 55,
    head: -45,
    upperArmFront: 95,
    lowerArmFront: -60,
    upperArmBack: 120,
    lowerArmBack: -70,
    upperLegFront: 95,
    lowerLegFront: -5,
    upperLegBack: 150,
    lowerLegBack: 110,
  },
  // Forward smash wind-up: wide stance, weight back, the front fist cocked behind the shoulder.
  forwardSmashWindup: {
    torso: -5,
    head: 0,
    upperArmFront: 210,
    lowerArmFront: 150,
    upperArmBack: 110,
    lowerArmBack: -80,
    upperLegFront: 135,
    lowerLegFront: 40,
    upperLegBack: 210,
    lowerLegBack: 20,
  },
  // Forward smash: lunging into a full-reach straight punch, the back arm thrown behind.
  forwardSmash: {
    torso: 40,
    head: -30,
    upperArmFront: 40,
    lowerArmFront: 0,
    upperArmBack: 160,
    lowerArmBack: -30,
    upperLegFront: 125,
    lowerLegFront: 35,
    upperLegBack: 220,
    lowerLegBack: 10,
  },
  // Up smash wind-up: crouched low with the front knee loaded.
  upSmashWindup: {
    torso: 25,
    head: -15,
    upperArmFront: 110,
    lowerArmFront: -100,
    upperArmBack: 140,
    lowerArmBack: -90,
    upperLegFront: 140,
    lowerLegFront: 70,
    upperLegBack: 205,
    lowerLegBack: 35,
  },
  // Up smash, two keys: a flip kick that swings the front leg straight up and over.
  upSmash: {
    torso: -40,
    head: 30,
    upperArmFront: 200,
    lowerArmFront: -20,
    upperArmBack: 230,
    lowerArmBack: -20,
    upperLegFront: 10,
    lowerLegFront: 0,
    upperLegBack: 190,
    lowerLegBack: 5,
  },
  upSmashEnd: {
    torso: -45,
    head: 30,
    upperArmFront: 200,
    lowerArmFront: -20,
    upperArmBack: 230,
    lowerArmBack: -20,
    upperLegFront: -35,
    lowerLegFront: 15,
    upperLegBack: 190,
    lowerLegBack: 5,
  },
  // Down smash wind-up: tucked into a low squat.
  downSmashWindup: {
    torso: 10,
    head: -5,
    upperArmFront: 140,
    lowerArmFront: -90,
    upperArmBack: 160,
    lowerArmBack: -90,
    upperLegFront: 150,
    lowerLegFront: 80,
    upperLegBack: 210,
    lowerLegBack: 80,
  },
  // Down smash: a split kick, both legs shooting out flat along the floor, arms out for balance.
  downSmash: {
    torso: 0,
    head: 0,
    upperArmFront: 90,
    lowerArmFront: 0,
    upperArmBack: -90,
    lowerArmBack: 0,
    upperLegFront: 95,
    lowerLegFront: 0,
    upperLegBack: 265,
    lowerLegBack: 0,
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
