import { CENTRED_STICK, attackInput, trackStick } from './attack-input';
import { FIGHTER } from './config';
import { NEUTRAL_INPUT, pressed } from './input';
import { approach } from './math';
import { findMove } from './move-data';
import { moveSlot } from './move-slots';
import { findCharacter } from './registry';
import { nextPose } from './poses';
import { REST_POSE } from './skeleton';
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
    moveId: null,
    damage: 0,
    stocks,
    kos: 0,
    falls: 0,
    damageDealt: 0,
    lastHitBy: null,
    hitstunFrames: 0,
    invulnerableFrames: 0,
    hitTargets: [],
    stick: CENTRED_STICK,
    previousInput: NEUTRAL_INPUT,
    pose: REST_POSE,
  };
};

const isControllable = (action: FighterAction): boolean =>
  action === 'idle' || action === 'run' || action === 'airborne';

const standsOn = (x: number, y: number, platform: PlatformDef): boolean =>
  x >= platform.bounds.left &&
  x <= platform.bounds.right &&
  Math.abs(y - platform.bounds.top) < 1e-6;

/**
 * Advances one fighter by one frame: control, physics, stage collision and its body pose.
 * Combat between fighters and blast zones are handled by the simulation afterwards.
 */
export const updateFighter = (
  fighter: FighterState,
  input: PlayerInput,
  stage: StageDef,
  /** The match frame, for the idle breathing. */
  frame = 0,
): FighterState => {
  if (fighter.action === 'eliminated') return { ...fighter, previousInput: input };

  const prev = fighter.previousInput;
  let { x: px, y: py } = fighter.position;
  let { x: vx, y: vy } = fighter.velocity;
  let { facing, grounded, jumpsRemaining, action, actionFrame, moveId, hitstunFrames, hitTargets } =
    fighter;
  // A press asks for the move in a slot (#28); an empty slot does nothing.
  const stick = trackStick(fighter.stick, input);
  const button = pressed(input, prev, 'attack')
    ? 'attack'
    : pressed(input, prev, 'special')
      ? 'special'
      : null;
  // Down with a button is a down attack on the platform, not a drop through it.
  const wantsDrop = input.y < DROP_THRESHOLD && button === null;

  // Still supported by the platform we were standing on? Walking off an edge makes us airborne.
  const support = grounded ? stage.platforms.find((p) => standsOn(px, py, p)) : undefined;
  if (grounded && (!support || (support.passThrough && wantsDrop && isControllable(action)))) {
    grounded = false;
    jumpsRemaining = Math.min(jumpsRemaining, FIGHTER.totalJumps - 1);
    if (support) py -= 0.05; // drop through the platform
  }

  actionFrame += 1;

  const choice =
    button === null ? null : moveSlot({ grounded, button, attack: attackInput(stick, facing) });
  const startMoveId = choice ? findCharacter(fighter.characterId)?.moves[choice.slot] : undefined;
  const startable =
    choice && startMoveId !== undefined
      ? { moveId: startMoveId, turnAround: choice.turnAround }
      : null;

  if (action === 'hitstun') {
    hitstunFrames -= 1;
    if (hitstunFrames <= 0) {
      action = grounded ? 'idle' : 'airborne';
      actionFrame = 0;
    }
  } else if (action === 'attack') {
    // The move runner (ADR 0006): play the move's frames, then hand control back.
    if (moveId === null || actionFrame >= findMove(moveId).totalFrames) {
      action = grounded ? 'idle' : 'airborne';
      actionFrame = 0;
      moveId = null;
      hitTargets = [];
    }
  } else if (startable) {
    action = 'attack';
    actionFrame = 0;
    moveId = startable.moveId;
    if (startable.turnAround) facing = facing === 1 ? -1 : 1;
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

  const moved: FighterState = {
    ...fighter,
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    facing,
    grounded,
    jumpsRemaining,
    action,
    actionFrame,
    moveId,
    hitstunFrames,
    hitTargets,
    invulnerableFrames: Math.max(0, fighter.invulnerableFrames - 1),
    stick,
    previousInput: input,
  };
  // Eased before combat, so hurtboxes built from the pose match this frame's body.
  return { ...moved, pose: nextPose(moved, frame) };
};
