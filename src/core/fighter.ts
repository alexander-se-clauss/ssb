import { FIGHTER, JAB } from './config';
import { NEUTRAL_INPUT, pressed } from './input';
import { approach } from './math';
import type {
  FighterAction,
  FighterState,
  PlatformDef,
  PlayerInput,
  PlayerSlot,
  StageDef,
} from './types';

const DROP_THRESHOLD = -0.5;
const FACE_THRESHOLD = 0.2;
const MOVE_EPSILON = 0.001;

export const createFighter = (
  slot: PlayerSlot,
  characterId: string,
  stage: StageDef,
  stocks: number,
): FighterState => {
  const spawn = stage.spawnPoints[slot % stage.spawnPoints.length] ?? { x: 0, y: 3 };
  return {
    slot,
    characterId,
    position: spawn,
    velocity: { x: 0, y: 0 },
    facing: spawn.x > 0 ? -1 : 1,
    grounded: false,
    jumpsRemaining: FIGHTER.totalJumps - 1,
    action: 'airborne',
    actionFrame: 0,
    damage: 0,
    stocks,
    kos: 0,
    falls: 0,
    lastHitBy: null,
    hitstunFrames: 0,
    invulnerableFrames: 0,
    hitTargets: [],
    previousInput: NEUTRAL_INPUT,
  };
};

const isControllable = (action: FighterAction): boolean =>
  action === 'idle' || action === 'run' || action === 'airborne';

const standsOn = (x: number, y: number, platform: PlatformDef): boolean =>
  x >= platform.bounds.left &&
  x <= platform.bounds.right &&
  Math.abs(y - platform.bounds.top) < 1e-6;

/**
 * Advances one fighter by one frame: control, physics and stage collision.
 * Combat between fighters and blast zones are handled by the simulation afterwards.
 */
export const updateFighter = (
  fighter: FighterState,
  input: PlayerInput,
  stage: StageDef,
): FighterState => {
  if (fighter.action === 'eliminated') return { ...fighter, previousInput: input };

  const prev = fighter.previousInput;
  let { x: px, y: py } = fighter.position;
  let { x: vx, y: vy } = fighter.velocity;
  let { facing, grounded, jumpsRemaining, action, actionFrame, hitstunFrames, hitTargets } =
    fighter;
  const wantsDrop = input.y < DROP_THRESHOLD;

  // Still supported by the platform we were standing on? Walking off an edge makes us airborne.
  const support = grounded ? stage.platforms.find((p) => standsOn(px, py, p)) : undefined;
  if (grounded && (!support || (support.passThrough && wantsDrop && isControllable(action)))) {
    grounded = false;
    jumpsRemaining = Math.min(jumpsRemaining, FIGHTER.totalJumps - 1);
    if (support) py -= 0.05; // drop through the platform
  }

  actionFrame += 1;

  if (action === 'hitstun') {
    hitstunFrames -= 1;
    if (hitstunFrames <= 0) {
      action = grounded ? 'idle' : 'airborne';
      actionFrame = 0;
    }
  } else if (action === 'jab') {
    if (actionFrame >= JAB.totalFrames) {
      action = grounded ? 'idle' : 'airborne';
      actionFrame = 0;
      hitTargets = [];
    }
  } else if (pressed(input, prev, 'attack')) {
    action = 'jab';
    actionFrame = 0;
    hitTargets = [];
  } else if (pressed(input, prev, 'jump') && jumpsRemaining > 0) {
    vy = grounded ? FIGHTER.jumpVelocity : FIGHTER.doubleJumpVelocity;
    jumpsRemaining -= 1;
    grounded = false;
  }

  // Horizontal movement.
  if (isControllable(action)) {
    if (Math.abs(input.x) > FACE_THRESHOLD && grounded) facing = input.x > 0 ? 1 : -1;
    if (grounded) {
      vx = approach(vx, input.x * FIGHTER.walkSpeed, FIGHTER.groundAcceleration);
    } else if (Math.abs(input.x) > 0.1) {
      vx = approach(vx, input.x * FIGHTER.airSpeed, FIGHTER.airAcceleration);
    } else {
      vx = approach(vx, 0, FIGHTER.airFriction);
    }
  } else {
    vx = approach(vx, 0, grounded ? FIGHTER.groundFriction : FIGHTER.airFriction);
  }

  // Gravity. Holding down while falling fast-falls.
  if (!grounded) {
    const fastFalling = isControllable(action) && wantsDrop && vy < 0;
    vy = Math.max(
      vy - FIGHTER.gravity,
      -(fastFalling ? FIGHTER.fastFallSpeed : FIGHTER.maxFallSpeed),
    );
  }

  const nextX = px + vx;
  const nextY = py + vy;

  // Landing: feet crossed a platform top from above this frame.
  if (!grounded && vy <= 0) {
    const landing = stage.platforms.find(
      (p) =>
        !(p.passThrough && wantsDrop) &&
        nextX >= p.bounds.left &&
        nextX <= p.bounds.right &&
        py >= p.bounds.top &&
        nextY <= p.bounds.top,
    );
    if (landing) {
      px = nextX;
      py = landing.bounds.top;
      vy = 0;
      grounded = true;
      jumpsRemaining = FIGHTER.totalJumps;
    } else {
      px = nextX;
      py = nextY;
    }
  } else {
    px = nextX;
    py = nextY;
  }

  // Solid platforms push the body out sideways or from below.
  for (const platform of stage.platforms) {
    if (platform.passThrough) continue;
    const b = platform.bounds;
    const half = FIGHTER.width / 2;
    const overlaps =
      px + half > b.left &&
      px - half < b.right &&
      py < b.top - 1e-6 &&
      py + FIGHTER.height > b.bottom;
    if (!overlaps) continue;
    const pushLeft = px + half - b.left;
    const pushRight = b.right - (px - half);
    const pushDown = py + FIGHTER.height - b.bottom;
    const smallest = Math.min(pushLeft, pushRight, pushDown);
    if (smallest === pushDown) {
      py = b.bottom - FIGHTER.height;
      vy = Math.min(vy, 0);
    } else if (smallest === pushLeft) {
      px = b.left - half;
      vx = Math.min(vx, 0);
    } else {
      px = b.right + half;
      vx = Math.max(vx, 0);
    }
  }

  // Resolve locomotion actions from the physical state.
  if (isControllable(action)) {
    const next: FighterAction = !grounded
      ? 'airborne'
      : Math.abs(vx) > MOVE_EPSILON
        ? 'run'
        : 'idle';
    if (next !== action) {
      action = next;
      actionFrame = 0;
    }
  }

  return {
    ...fighter,
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    facing,
    grounded,
    jumpsRemaining,
    action,
    actionFrame,
    hitstunFrames,
    hitTargets,
    invulnerableFrames: Math.max(0, fighter.invulnerableFrames - 1),
    previousInput: input,
  };
};
