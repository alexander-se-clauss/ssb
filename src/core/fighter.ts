import { CENTRED_STICK, attackInput, trackStick } from './attack-input';
import { DODGE, FIGHTER, INPUT } from './config';
import { NEUTRAL_INPUT, pressed } from './input';
import { approach } from './math';
import { findMove } from './move-data';
import { isAerialSlot, moveSlot } from './move-slots';
import { findCharacter } from './registry';
import { nextPose } from './poses';
import { REST_POSE } from './skeleton';
import { isDodge, type BufferedAction, type MoveId } from './moves';
import type {
  BufferedInput,
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
    airDodgeUsed: false,
    turnedFrom: null,
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
    landingLagFrames: 0,
    hitlagFrames: 0,
    invulnerableFrames: 0,
    hitTargets: [],
    buffer: null,
    stick: CENTRED_STICK,
    previousInput: NEUTRAL_INPUT,
    pose: REST_POSE,
  };
};

const isControllable = (action: FighterAction): boolean =>
  action === 'idle' || action === 'run' || action === 'airborne';

/** The frame data of a dodge action, or undefined for any other action. */
const dodgeOf = (action: FighterAction) =>
  action === 'spotDodge'
    ? DODGE.spot
    : action === 'forwardRoll' || action === 'backRoll'
      ? DODGE.roll
      : action === 'airDodge'
        ? DODGE.air
        : undefined;

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
  // A press asks for the move in a slot (#28) and waits in the buffer until the fighter can act.
  const stick = trackStick(fighter.stick, input);
  const button = pressed(input, prev, 'attack')
    ? 'attack'
    : pressed(input, prev, 'special')
      ? 'special'
      : null;
  const dodgePress = pressed(input, prev, 'shield');
  const press = (grounded: boolean): BufferedInput | null => {
    if (button === null) {
      // The dodge button dodges on the ground (#35), and in the air once per airtime (#36). A
      // roll goes the way the stick points. An air dodge reads its direction from the stick when
      // it starts; one pressed in the jump squat starts once the jump leaves the ground, as in
      // Ultimate.
      if (!dodgePress) return null;
      if (!grounded || fighter.action === 'jumpsquat') {
        return fighter.airDodgeUsed ? null : { action: 'airDodge', face: fighter.facing, age: 0 };
      }
      if (Math.abs(input.x) < DODGE.rollStick) {
        return { action: 'spotDodge', face: fighter.facing, age: 0 };
      }
      return { action: 'roll', face: input.x > 0 ? 1 : -1, age: 0 };
    }
    const choice = moveSlot({ grounded, button, attack: attackInput(stick, fighter.facing) });
    const face = choice.turnAround ? (fighter.facing === 1 ? -1 : 1) : fighter.facing;
    return { action: choice.slot, face, age: 0 };
  };

  // Frozen by a hit: everything stands still. A press is still buffered, and the buffer does not
  // age; the stick is still tracked, so a stick held through the freeze is not read as a flick.
  if (fighter.hitlagFrames > 0) {
    return {
      ...fighter,
      hitlagFrames: fighter.hitlagFrames - 1,
      buffer: press(fighter.grounded) ?? fighter.buffer,
      stick,
      previousInput: input,
    };
  }

  let { x: px, y: py } = fighter.position;
  let { x: vx, y: vy } = fighter.velocity;
  let {
    facing,
    grounded,
    jumpsRemaining,
    airDodgeUsed,
    turnedFrom,
    action,
    actionFrame,
    moveId,
    hitstunFrames,
    landingLagFrames,
    hitTargets,
  } = fighter;
  turnedFrom =
    turnedFrom && turnedFrom.age < DODGE.turnGraceFrames
      ? { ...turnedFrom, age: turnedFrom.age + 1 }
      : null;
  // Down with a button is a down attack or a spot dodge on the platform, not a drop through it,
  // also when the dodge waited in the buffer.
  const waiting = fighter.buffer;
  const dodgeComing =
    fighter.grounded &&
    (dodgePress ||
      (waiting !== null && isDodge(waiting.action) && waiting.age < INPUT.bufferFrames));
  const wantsDrop = input.y < DROP_THRESHOLD && button === null && !dodgeComing;

  // Still supported by the platform we were standing on? Walking off an edge makes us airborne.
  const support = grounded ? stage.platforms.find((p) => standsOn(px, py, p)) : undefined;
  if (grounded && (!support || (support.passThrough && wantsDrop && isControllable(action)))) {
    grounded = false;
    jumpsRemaining = Math.min(jumpsRemaining, FIGHTER.totalJumps - 1);
    if (support) py -= 0.05; // drop through the platform
    // Sliding off an edge during landing lag ends it: the fighter falls under control.
    if (action === 'landing') {
      action = 'airborne';
      actionFrame = 0;
      landingLagFrames = 0;
    }
  }

  actionFrame += 1;

  const kept = fighter.buffer && fighter.buffer.age < INPUT.bufferFrames ? fighter.buffer : null;
  let buffer = press(grounded) ?? (kept && { ...kept, age: kept.age + 1 });
  const slotMove = (action: BufferedAction): MoveId | undefined =>
    isDodge(action) || action === 'block'
      ? undefined
      : findCharacter(fighter.characterId)?.moves[action];
  /** Starts a move from the buffered press, facing the way the press asked for. */
  const startMove = (id: MoveId, face: 1 | -1): void => {
    buffer = null;
    action = 'attack';
    actionFrame = 0;
    moveId = id;
    facing = face;
    hitTargets = [];
  };
  // An empty slot does nothing: the press is dropped, and a jump on the same frame still counts.
  // So is a dodge that can no longer start: a ground dodge once the fighter left the ground, an
  // air dodge on the ground or used up.
  const bufferedMove = buffer ? slotMove(buffer.action) : undefined;
  const dodgeCanStart = (dodge: BufferedAction): boolean =>
    dodge === 'airDodge' ? !grounded && !airDodgeUsed : grounded;
  const bufferedDodge =
    buffer && isDodge(buffer.action) && dodgeCanStart(buffer.action) ? buffer.action : undefined;
  if (
    buffer &&
    bufferedMove === undefined &&
    bufferedDodge === undefined &&
    isControllable(action)
  ) {
    buffer = null;
  }

  if (action === 'hitstun') {
    hitstunFrames -= 1;
    if (hitstunFrames <= 0) {
      action = grounded ? 'idle' : 'airborne';
      actionFrame = 0;
    }
  } else if (action === 'attack') {
    // The move runner (ADR 0006): play the move's frames, give way in a cancel window, then hand
    // control back.
    const move = moveId === null ? undefined : findMove(moveId);
    const queued = buffer;
    const cancel =
      queued &&
      move?.cancels.find(
        (c) => c.on === queued.action && actionFrame >= c.from && actionFrame < c.to,
      );
    const next = cancel ? (cancel.into ?? slotMove(cancel.on)) : undefined;
    if (queued && next !== undefined) {
      startMove(next, queued.face);
    } else if (!move || actionFrame >= move.totalFrames) {
      action = grounded ? 'idle' : 'airborne';
      actionFrame = 0;
      moveId = null;
      hitTargets = [];
    }
  } else if (dodgeOf(action) !== undefined) {
    // A dodge plays out its frames; a press waits in the buffer. A forward roll ends turned round.
    if (actionFrame >= (dodgeOf(action)?.totalFrames ?? 0)) {
      if (action === 'forwardRoll') facing = facing === 1 ? -1 : 1;
      action = grounded ? 'idle' : 'airborne';
      actionFrame = 0;
    }
  } else if (action === 'landing') {
    // Stuck for the landing lag; a press waits in the buffer.
    landingLagFrames -= 1;
    if (landingLagFrames <= 0) {
      action = grounded ? 'idle' : 'airborne';
      actionFrame = 0;
    }
  } else if (action === 'jumpsquat') {
    // Crouched to jump, as in Melee: an attack pressed now is still a ground attack, so a stick
    // flicked up for an up smash does not lose it to tap-jump.
    if (buffer && bufferedMove !== undefined) {
      startMove(bufferedMove, buffer.face);
    } else if (actionFrame >= FIGHTER.jumpSquatFrames || !grounded) {
      vy = FIGHTER.jumpVelocity;
      // This is the ground jump, also when the fighter slid off an edge while crouched, which
      // has used it up already.
      jumpsRemaining = Math.min(jumpsRemaining, FIGHTER.totalJumps - 1);
      grounded = false;
      action = 'airborne';
      actionFrame = 0;
    }
  } else if (buffer && bufferedMove !== undefined) {
    startMove(bufferedMove, buffer.face);
  } else if (buffer && bufferedDodge !== undefined) {
    actionFrame = 0;
    if (bufferedDodge === 'roll') {
      // Towards the facing a forward roll, away from it a back roll, counted from the facing
      // before a turn the stick made just now.
      if (turnedFrom) facing = turnedFrom.facing;
      action = buffer.face === facing ? 'forwardRoll' : 'backRoll';
    } else {
      action = bufferedDodge;
    }
    turnedFrom = null;
    buffer = null;
    vx = 0;
    if (bufferedDodge === 'airDodge') {
      // Off in the stick's direction, or held in place without one.
      airDodgeUsed = true;
      const tilt = Math.hypot(input.x, input.y);
      const speed = tilt >= DODGE.air.directionStick ? DODGE.air.speed / tilt : 0;
      vx = input.x * speed;
      vy = input.y * speed;
    }
  } else if (pressed(input, prev, 'jump') && jumpsRemaining > 0) {
    if (grounded) {
      action = 'jumpsquat';
      actionFrame = 0;
    } else {
      vy = FIGHTER.doubleJumpVelocity;
      jumpsRemaining -= 1;
    }
  }

  // An aerial drifts and fast-falls like a fighter in the air without an attack, as in Melee.
  // Only aerials: a ground move that slides off an edge keeps its locked movement.
  const inAerial =
    action === 'attack' &&
    !grounded &&
    moveId !== null &&
    findMove(moveId).landingLag !== undefined;

  // Horizontal movement. A launch faster than the fighter can drift bleeds off quickly, as
  // knockback decays in Melee; without it a sideways hit carries on almost undamped.
  // An air dodge carries the fighter with gravity paused, slowing down, until `DODGE.air.moveTo`.
  const airDodging = action === 'airDodge' && actionFrame < DODGE.air.moveTo;
  if (airDodging) {
    if (actionFrame > 0) {
      vx *= DODGE.air.drag;
      vy *= DODGE.air.drag;
    }
  } else if (action === 'forwardRoll' || action === 'backRoll') {
    // A roll covers its distance at an even speed, then stops dead.
    const { moveFrom, moveTo, distance } = DODGE.roll;
    const rolling = actionFrame >= moveFrom && actionFrame < moveTo;
    const travel = action === 'forwardRoll' ? facing : -facing;
    vx = rolling ? (travel * distance) / (moveTo - moveFrom) : 0;
  } else if (!grounded && Math.abs(vx) > FIGHTER.airSpeed) {
    vx = approach(vx, Math.sign(vx) * FIGHTER.airSpeed, FIGHTER.launchDecay);
  } else if (isControllable(action) || inAerial) {
    const stickFacing = input.x > 0 ? 1 : -1;
    if (Math.abs(input.x) > FACE_THRESHOLD && grounded && stickFacing !== facing) {
      // Turning back to where the fighter faced before the last turn undoes that turn.
      turnedFrom = turnedFrom?.facing === stickFacing ? null : (turnedFrom ?? { facing, age: 0 });
      facing = stickFacing;
    }
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
  if (!grounded && !airDodging) {
    const fastFalling = (isControllable(action) || inAerial) && wantsDrop && vy < 0;
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
      airDodgeUsed = false;
      // An aerial or air dodge press still waiting in the buffer is dropped: neither plays on
      // the ground.
      if (buffer && (isAerialSlot(buffer.action) || buffer.action === 'airDodge')) buffer = null;
      // An aerial or air dodge ends on landing, with its own landing lag; a plain landing has a
      // short one. A launched fighter in hitstun lands without lag.
      const lag =
        action === 'airborne'
          ? FIGHTER.landingLagFrames
          : action === 'airDodge'
            ? DODGE.air.landingLag
            : action === 'attack' && moveId !== null
              ? findMove(moveId).landingLag
              : undefined;
      if (lag !== undefined) {
        landingLagFrames = lag;
        action = 'landing';
        actionFrame = 0;
        moveId = null;
        hitTargets = [];
      }
    } else {
      px = nextX;
      py = nextY;
    }
  } else {
    px = nextX;
    py = nextY;
  }

  // A roll stops at the edge of its platform instead of rolling off.
  if ((action === 'forwardRoll' || action === 'backRoll') && grounded && support) {
    px = Math.min(Math.max(px, support.bounds.left), support.bounds.right);
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

  // A dodge cannot be hit on its invulnerable frames; a longer invulnerability (a respawn) stays.
  const dodge = dodgeOf(action);
  const dodgeInvulnerable =
    dodge !== undefined &&
    actionFrame >= dodge.invulnerableFrom &&
    actionFrame < dodge.invulnerableTo;

  const moved: FighterState = {
    ...fighter,
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    facing,
    grounded,
    jumpsRemaining,
    airDodgeUsed,
    turnedFrom,
    action,
    actionFrame,
    moveId,
    hitstunFrames,
    landingLagFrames,
    hitTargets,
    buffer,
    invulnerableFrames: Math.max(fighter.invulnerableFrames - 1, dodgeInvulnerable ? 1 : 0),
    stick,
    previousInput: input,
  };
  // Eased before combat, so hurtboxes built from the pose match this frame's body.
  return { ...moved, pose: nextPose(moved, frame) };
};
