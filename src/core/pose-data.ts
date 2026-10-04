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
  | 'land'
  | 'neutralAir'
  | 'forwardAirWindup'
  | 'forwardAir'
  | 'backAirWindup'
  | 'backAir'
  | 'upAirStart'
  | 'upAir'
  | 'upAirEnd'
  | 'downAirWindup'
  | 'downAir'
  | 'sidestep'
  | 'roll'
  | 'airDodge'
  | 'ledge'
  | 'hurt'
  | 'tumble'
  | 'haymakerWindup'
  | 'haymaker'
  | 'springJackStart'
  | 'springJack'
  | 'guard'
  | 'counterStance'
  | 'counterStrike'
  | 'thruster';

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
  // Landing: knees bent to soak up the fall, chest forward.
  land: {
    torso: 25,
    head: -15,
    upperArmFront: 122,
    lowerArmFront: -90,
    upperArmBack: 150,
    lowerArmBack: -95,
    upperLegFront: 120,
    lowerLegFront: 90,
    upperLegBack: 210,
    lowerLegBack: 70,
  },
  // Neutral aerial: a sex kick, the front leg straight out and the back knee tucked.
  neutralAir: {
    torso: -10,
    head: 5,
    upperArmFront: 140,
    lowerArmFront: -80,
    upperArmBack: 200,
    lowerArmBack: -60,
    upperLegFront: 95,
    lowerLegFront: -5,
    upperLegBack: 160,
    lowerLegBack: 90,
  },
  // Forward aerial wind-up: both fists raised high behind the head, knees tucked.
  forwardAirWindup: {
    torso: 15,
    head: -5,
    upperArmFront: -45,
    lowerArmFront: -20,
    upperArmBack: -40,
    lowerArmBack: -20,
    upperLegFront: 120,
    lowerLegFront: 90,
    upperLegBack: 170,
    lowerLegBack: 80,
  },
  // Forward aerial: a double-fist hammer swung down in front.
  forwardAir: {
    torso: 30,
    head: -20,
    upperArmFront: 85,
    lowerArmFront: 10,
    upperArmBack: 80,
    lowerArmBack: 10,
    upperLegFront: 140,
    lowerLegFront: 70,
    upperLegBack: 190,
    lowerLegBack: 60,
  },
  // Back aerial wind-up: the back knee chambered, looking over the shoulder.
  backAirWindup: {
    torso: 25,
    head: -20,
    upperArmFront: 120,
    lowerArmFront: -90,
    upperArmBack: 150,
    lowerArmBack: -90,
    upperLegFront: 130,
    lowerLegFront: 90,
    upperLegBack: 200,
    lowerLegBack: 100,
  },
  // Back aerial: a mule kick straight behind, leaning forward over it.
  backAir: {
    torso: 35,
    head: -25,
    upperArmFront: 120,
    lowerArmFront: -90,
    upperArmBack: 150,
    lowerArmBack: -90,
    upperLegFront: 130,
    lowerLegFront: 90,
    upperLegBack: 265,
    lowerLegBack: -5,
  },
  // Up aerial, three keys: a flip kick, the front leg swinging up in front and over the head.
  upAirStart: {
    torso: -10,
    head: 5,
    upperArmFront: 160,
    lowerArmFront: -40,
    upperArmBack: 200,
    lowerArmBack: -30,
    upperLegFront: 110,
    lowerLegFront: 30,
    upperLegBack: 170,
    lowerLegBack: 60,
  },
  upAir: {
    torso: -30,
    head: 25,
    upperArmFront: 210,
    lowerArmFront: -20,
    upperArmBack: 230,
    lowerArmBack: -20,
    upperLegFront: 10,
    lowerLegFront: 0,
    upperLegBack: 170,
    lowerLegBack: 60,
  },
  upAirEnd: {
    torso: -40,
    head: 30,
    upperArmFront: 210,
    lowerArmFront: -20,
    upperArmBack: 230,
    lowerArmBack: -20,
    upperLegFront: -40,
    lowerLegFront: 10,
    upperLegBack: 170,
    lowerLegBack: 60,
  },
  // Down aerial wind-up: both knees pulled up to the chest.
  downAirWindup: {
    torso: 5,
    head: -10,
    upperArmFront: 90,
    lowerArmFront: -40,
    upperArmBack: -70,
    lowerArmBack: 40,
    upperLegFront: 100,
    lowerLegFront: 120,
    upperLegBack: 120,
    lowerLegBack: 110,
  },
  // Down aerial: a stomp, both legs driven straight down, arms thrown up for balance.
  downAir: {
    torso: 0,
    head: -10,
    upperArmFront: 60,
    lowerArmFront: -30,
    upperArmBack: -60,
    lowerArmBack: 30,
    upperLegFront: 175,
    lowerLegFront: 0,
    upperLegBack: 185,
    lowerLegBack: 0,
  },
  // Sidestep: drawn up tall and narrow, arms pulled in to the chest, feet together.
  sidestep: {
    torso: -8,
    head: 5,
    upperArmFront: 165,
    lowerArmFront: -130,
    upperArmBack: 175,
    lowerArmBack: -120,
    upperLegFront: 172,
    lowerLegFront: 10,
    upperLegBack: 188,
    lowerLegBack: 10,
  },
  // Roll: tucked into a ball, knees to the chest and arms round them; the view somersaults it.
  roll: {
    torso: 45,
    head: -35,
    upperArmFront: 130,
    lowerArmFront: -100,
    upperArmBack: 140,
    lowerArmBack: -100,
    upperLegFront: 100,
    lowerLegFront: 150,
    upperLegBack: 115,
    lowerLegBack: 145,
  },
  // Air dodge: upright, knees lifted a little and arms drawn in; the view spins it round.
  airDodge: {
    torso: 0,
    head: 0,
    upperArmFront: 160,
    lowerArmFront: -125,
    upperArmBack: 170,
    lowerArmBack: -120,
    upperLegFront: 160,
    lowerLegFront: 40,
    upperLegBack: 190,
    lowerLegBack: 45,
  },
  // Hanging from a ledge: both arms stretched up and forward onto it, legs hanging down.
  ledge: {
    torso: 10,
    head: -15,
    upperArmFront: 15,
    lowerArmFront: 0,
    upperArmBack: 10,
    lowerArmBack: 0,
    upperLegFront: 172,
    lowerLegFront: 12,
    upperLegBack: 188,
    lowerLegBack: 15,
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
  // Rivet's neutral special (#39): the fist swung far back over the shoulder, weight on the back
  // foot.
  haymakerWindup: {
    torso: -15,
    head: 5,
    upperArmFront: 230,
    lowerArmFront: 130,
    upperArmBack: 90,
    lowerArmBack: -60,
    upperLegFront: 135,
    lowerLegFront: 40,
    upperLegBack: 210,
    lowerLegBack: 20,
  },
  // ...then thrown with the whole body in a long lunge.
  haymaker: {
    torso: 45,
    head: -35,
    upperArmFront: 45,
    lowerArmFront: -5,
    upperArmBack: 170,
    lowerArmBack: -20,
    upperLegFront: 120,
    lowerLegFront: 30,
    upperLegBack: 225,
    lowerLegBack: 10,
  },
  // Rivet's up special (#39): crouched with the fist low, about to spring.
  springJackStart: {
    torso: 30,
    head: -20,
    upperArmFront: 160,
    lowerArmFront: -40,
    upperArmBack: 150,
    lowerArmBack: -90,
    upperLegFront: 140,
    lowerLegFront: 70,
    upperLegBack: 205,
    lowerLegBack: 35,
  },
  // ...then rising, the fist straight up overhead and the legs trailing.
  springJack: {
    torso: 10,
    head: -5,
    upperArmFront: -10,
    lowerArmFront: 0,
    upperArmBack: 200,
    lowerArmBack: -30,
    upperLegFront: 170,
    lowerLegFront: 40,
    upperLegBack: 200,
    lowerLegBack: 50,
  },
  // Iron Guard (#50): braced low, both forearms raised in front of the face.
  guard: {
    torso: 28,
    head: -8,
    upperArmFront: 95,
    lowerArmFront: -125,
    upperArmBack: 105,
    lowerArmBack: -130,
    upperLegFront: 140,
    lowerLegFront: 60,
    upperLegBack: 215,
    lowerLegBack: 45,
  },
  // Riposte (#51): Vela settles low and side-on, the arm cannon held across her body, waiting.
  counterStance: {
    torso: 10,
    head: -5,
    upperArmFront: 150,
    lowerArmFront: -70,
    upperArmBack: 120,
    lowerArmBack: -110,
    upperLegFront: 140,
    lowerLegFront: 55,
    upperLegBack: 215,
    lowerLegBack: 40,
  },
  // ...and answers with the cannon thrust straight out, braced against the recoil.
  counterStrike: {
    torso: 30,
    head: -25,
    upperArmFront: 75,
    lowerArmFront: 0,
    upperArmBack: 160,
    lowerArmBack: -40,
    upperLegFront: 125,
    lowerLegFront: 35,
    upperLegBack: 220,
    lowerLegBack: 30,
  },
  // Thruster (#53): leaning into the boost, arms swept back, legs trailing behind.
  thruster: {
    torso: 35,
    head: -20,
    upperArmFront: 205,
    lowerArmFront: 15,
    upperArmBack: 215,
    lowerArmBack: 15,
    upperLegFront: 195,
    lowerLegFront: 25,
    upperLegBack: 210,
    lowerLegBack: 35,
  },
};
