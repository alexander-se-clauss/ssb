import { CENTRED_STICK, attackInput, trackStick } from './attack-input';
import { characterOf } from './character';
import {
  CROUCH,
  DODGE,
  FIGHTER_RULES,
  GRAB,
  HELPLESS,
  INPUT,
  KNOCKBACK,
  KNOCKDOWN,
  L_CANCEL,
  LEDGE,
  STICK,
} from './config';
import { NEUTRAL_INPUT, pressed } from './input';
import {
  climbPosition,
  hangPosition,
  isLedgeClimb,
  ledgeInReach,
  ledgeOption,
  type LedgeClimb,
} from './ledge';
import { approach, type Vec2 } from './math';
import { influence } from './di';
import { isSdiFlick, smashDi } from './sdi';
import {
  downedFrames,
  getupOption,
  isDowned,
  landTumble,
  techTimers,
  type DownedAction,
} from './tech';
import { baseDodge, dodgeFrames } from './dodge-frames';
import { mashes } from './grab';
import { isGroundMovement, moveOnGround } from './ground-movement';
import { findMove } from './move-data';
import { PRESS_SLOTS, isAerialSlot, moveSlot } from './move-slots';
import { nextPose } from './poses';
import { REST_POSE } from './skeleton';
import { isDodge, type BufferedAction, type DodgeKind, type MoveDef, type MoveId } from './moves';
import type {
  AerialLanding,
  BufferedInput,
  FighterAction,
  FighterState,
  PlatformDef,
  PlayerInput,
  PlayerSlot,
  StageDef,
} from './types';

/** Stick held down past this drops through a platform; crouching (#156) needs the same. */
const DROP_THRESHOLD = -CROUCH.stick;

export const createFighter = (
  slot: PlayerSlot,
  characterId: string,
  stage: StageDef,
  stocks: number,
): FighterState => {
  const spawn = stage.spawnPoints[slot % stage.spawnPoints.length] ?? { x: 0, y: 3 };
  const { stats } = characterOf(characterId);
  return {
    slot,
    characterId,
    position: spawn,
    velocity: { x: 0, y: 0 },
    knockback: { x: 0, y: 0 },
    tumbling: false,
    facing: spawn.x > 0 ? -1 : 1,
    grounded: false,
    jumpsRemaining: stats.airJumps,
    shortHop: false,
    airDodgeUsed: false,
    dodgeStreak: 0,
    dodgeRestFrames: DODGE.repeat.wearOffFrames,
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
    staleMoves: [],
    techWindow: 0,
    techLockout: 0,
    holding: null,
    heldBy: null,
    escapeFrames: 0,
    hitstunFrames: 0,
    landingLagFrames: 0,
    lCancelPress: null,
    lastLanding: null,
    hitlagFrames: 0,
    invulnerableFrames: 0,
    ledge: null,
    ledgeRegrabFrames: 0,
    hitTargets: [],
    buffer: null,
    stick: CENTRED_STICK,
    previousInput: NEUTRAL_INPUT,
    pose: REST_POSE,
  };
};

/** The grab a grab press asks for (#159): a dash grab out of a dash or run, a pivot grab out of a
 * run turn, the standing grab otherwise. */
const grabSlot = (action: FighterAction): 'grab' | 'dashGrab' | 'pivotGrab' =>
  action === 'dash' || action === 'run' ? 'dashGrab' : action === 'runTurn' ? 'pivotGrab' : 'grab';

const isControllable = (action: FighterAction): boolean =>
  isGroundMovement(action) || action === 'airborne';

/**
 * The landing lag of an aerial that lands on `frame` of its move: the normal one inside an
 * auto-cancel window (#148), the aerial's own otherwise.
 */
const aerialLandingLag = (move: MoveDef, frame: number, normal: number): number | undefined =>
  autoCancelled(move, frame) ? normal : move.landingLag;

/** Landing on `frame` of `move` falls in one of its auto-cancel windows (#148). */
const autoCancelled = ({ autoCancel }: MoveDef, frame: number): boolean =>
  autoCancel !== undefined && (frame < autoCancel.before || frame >= autoCancel.after);

/**
 * How an aerial lands on `frame` of its move: inside an auto-cancel window (#148) with the normal
 * landing lag, otherwise with its own, halved by an L-cancel (#149) when the dodge press that
 * counts came at most `L_CANCEL.windowFrames` ago, though never below the normal lag.
 */
const landAerial = (
  move: MoveDef,
  frame: number,
  normal: number,
  lCancelPress: number | null,
): { readonly lag: number; readonly how: AerialLanding } => {
  const own = aerialLandingLag(move, frame, normal) ?? normal;
  if (autoCancelled(move, frame)) return { lag: own, how: 'autoCancelled' };
  return lCancelPress !== null && lCancelPress < L_CANCEL.windowFrames
    ? { lag: Math.max(Math.ceil(own / 2), normal), how: 'lCancelled' }
    : { lag: own, how: 'missed' };
};

/** Frames since the press that counts for an L-cancel, one frame on; null once its lockout is over. */
const ageLCancel = (since: number | null): number | null =>
  since === null || since + 1 >= L_CANCEL.lockoutFrames ? null : since + 1;

/** A dodge press during an aerial counts for an L-cancel, unless the last one still locks it out. */
const pressLCancel = (since: number | null, pressedNow: boolean): number | null =>
  pressedNow && since === null ? 0 : since;

/**
 * Frames since the last dodge ended, one frame on (#150), counted no further than it matters. A
 * dodge that started this frame counts too, also one that ended at once by landing.
 */
const restFrom = (fighter: FighterState, dodgeStarted = false): number =>
  dodgeStarted || baseDodge(fighter.action) !== undefined
    ? 0
    : Math.min(fighter.dodgeRestFrames + 1, DODGE.repeat.wearOffFrames);

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
  /** Ledges other fighters hold (#40); a fighter cannot grab one of them. */
  ledgesTaken: readonly number[] = [],
): FighterState => {
  if (fighter.action === 'eliminated') return { ...fighter, previousInput: input };
  const character = characterOf(fighter.characterId);
  const { stats, moves } = character;

  const prev = fighter.previousInput;
  // A press asks for the move in a slot (#28) and waits in the buffer until the fighter can act.
  const stick = trackStick(fighter.stick, input);
  const button = pressed(input, prev, 'attack')
    ? 'attack'
    : pressed(input, prev, 'special')
      ? 'special'
      : null;
  const dodgePress = pressed(input, prev, 'shield');
  const grabPress = pressed(input, prev, 'grab');
  const isAerial = (id: MoveId): boolean =>
    PRESS_SLOTS.some((slot) => isAerialSlot(slot) && moves[slot] === id);
  // During an aerial the dodge button L-cancels (#149) instead of asking for an air dodge.
  const lCancelling =
    fighter.action === 'attack' &&
    !fighter.grounded &&
    fighter.moveId !== null &&
    isAerial(fighter.moveId);
  // The jump button jumps in full; the short hop button (#147) only jumps low from the ground.
  const jumpPressed = pressed(input, prev, 'jump') || pressed(input, prev, 'shortHop');
  const shortHopPressed = pressed(input, prev, 'shortHop') && !pressed(input, prev, 'jump');
  const press = (grounded: boolean): BufferedInput | null => {
    // A jump waits in the buffer like any press, so it is not lost while an aerial or a dodge
    // plays out. Not with no jump left, and not in hitstun: jumping out of it needs a fresh
    // press, as in Melee.
    const jumpPress = (): BufferedInput | null =>
      jumpPressed && (grounded || fighter.jumpsRemaining > 0) && fighter.action !== 'hitstun'
        ? {
            action: 'jump',
            face: fighter.facing,
            age: 0,
            ...(shortHopPressed && { shortHop: true }),
          }
        : null;
    if (button === null) {
      // The grab button grabs on the ground (#159); in the air it does nothing.
      if (grabPress)
        return grounded ? { action: 'grab', face: fighter.facing, age: 0 } : jumpPress();
      if (!dodgePress || lCancelling) return jumpPress();
      // The dodge button dodges on the ground (#35), and in the air once per airtime (#36). On
      // the ground the stick sideways rolls along the stage plane; up, down or centred sidesteps
      // out of it. An air dodge reads its direction from the stick when it starts; one pressed in
      // the jump squat starts once the jump leaves the ground, as in Ultimate.
      if (!grounded || fighter.action === 'jumpsquat') {
        return fighter.airDodgeUsed ? null : { action: 'airDodge', face: fighter.facing, age: 0 };
      }
      if (Math.abs(input.x) < DODGE.rollStick || Math.abs(input.x) <= Math.abs(input.y)) {
        const side = input.y <= -STICK.deadzone ? 'sidestepOut' : 'sidestepIn';
        return { action: side, face: fighter.facing, age: 0 };
      }
      return { action: 'roll', face: input.x > 0 ? 1 : -1, age: 0 };
    }
    const choice = moveSlot({ grounded, button, attack: attackInput(stick, fighter.facing) });
    // A press for an empty slot does nothing, so a jump pressed with it is buffered instead. So
    // is one for a block in the air, which cannot start there (#50).
    const id = moves[choice.slot];
    if (id === undefined || (!grounded && findMove(id).guard)) {
      const jump = jumpPress();
      if (jump) return jump;
    }
    const face = choice.turnAround ? (fighter.facing === 1 ? -1 : 1) : fighter.facing;
    return { action: choice.slot, face, age: 0 };
  };

  /** A new press replaces the waiting one, except that a jump never pushes out a move or dodge. */
  const latest = (
    fresh: BufferedInput | null,
    waiting: BufferedInput | null,
  ): BufferedInput | null =>
    fresh && !(fresh.action === 'jump' && waiting && waiting.action !== 'jump') ? fresh : waiting;

  // Frozen by a hit: everything stands still. A press is still buffered, and the buffer does not
  // age; the stick is still tracked, so a stick held through the freeze is not read as a flick.
  if (fighter.hitlagFrames > 0) {
    // DI (#154): the stick on the last frame of the freeze turns the launch it releases.
    // A slide along the ground after a crouch cancel (#156) stays as it is.
    const knockback =
      fighter.hitlagFrames === 1 && fighter.action === 'hitstun' && !fighter.grounded
        ? influence(fighter.knockback, input)
        : fighter.knockback;
    // SDI (#155): each fresh flick while frozen by a hit moves the fighter a little that way.
    const sdi = fighter.action === 'hitstun' && isSdiFlick(input, prev);
    const position = sdi
      ? smashDi(fighter.position, input, stage, character.stats.width / 2, fighter.grounded)
      : fighter.position;
    return {
      ...fighter,
      position,
      velocity: {
        x: fighter.velocity.x - fighter.knockback.x + knockback.x,
        y: fighter.velocity.y - fighter.knockback.y + knockback.y,
      },
      knockback,
      // A tech press (#158) counts while frozen, so a tumble that lands right after can tech.
      ...techTimers(fighter, dodgePress, true),
      hitlagFrames: fighter.hitlagFrames - 1,
      buffer: latest(press(fighter.grounded), fighter.buffer),
      lCancelPress: pressLCancel(fighter.lCancelPress, dodgePress && lCancelling),
      stick,
      previousInput: input,
    };
  }

  // Hanging from a ledge (#40): the fighter holds still and presses are not kept. From
  // `LEDGE.waitFrames` on, what it holds picks an option (#41); after `LEDGE.hangFrames` it lets go.
  if (fighter.action === 'ledge') {
    const actionFrame = fighter.actionFrame + 1;
    const held: FighterState = {
      ...fighter,
      actionFrame,
      buffer: null,
      invulnerableFrames: Math.max(fighter.invulnerableFrames - 1, 0),
      dodgeRestFrames: restFrom(fighter),
      // The tech timers (#158) run on; a press here is a ledge option, not a tech.
      ...techTimers(fighter, false),
      stick,
      previousInput: input,
    };
    const option =
      actionFrame >= LEDGE.waitFrames ? ledgeOption(input, prev, fighter.facing) : null;
    const ledge = fighter.ledge === null ? undefined : stage.ledges[fighter.ledge];
    /** Off the ledge into the air, beside the stage's wall rather than in it. */
    const letGo = (vy: number, invulnerableFrames: number): FighterState => ({
      ...held,
      position: {
        x: (ledge?.position.x ?? fighter.position.x) - fighter.facing * (stats.width / 2 + 0.01),
        y: fighter.position.y,
      },
      velocity: { x: 0, y: vy },
      action: 'airborne',
      actionFrame: 0,
      ledge: null,
      ledgeRegrabFrames: LEDGE.regrabFrames,
      invulnerableFrames: Math.max(held.invulnerableFrames, invulnerableFrames),
    });
    const climb = (action: LedgeClimb, invulnerableFrames: number): FighterState => ({
      ...held,
      action,
      actionFrame: 0,
      invulnerableFrames: Math.max(held.invulnerableFrames, invulnerableFrames),
    });
    const { getup } = LEDGE;
    const next: FighterState =
      option === 'jump'
        ? letGo(stats.jumpVelocity, getup.jump.invulnerableFrames)
        : option === 'drop' || actionFrame >= LEDGE.hangFrames
          ? letGo(0, 0)
          : option === 'stand'
            ? climb('ledgeStand', getup.stand.invulnerableFrames)
            : option === 'roll'
              ? climb('ledgeRoll', getup.roll.invulnerableFrames)
              : option === 'attack'
                ? climb('ledgeAttack', getup.attack.invulnerableFrames)
                : held;
    return { ...next, pose: nextPose(next, frame) };
  }

  // Climbing from a ledge onto the stage (#41) along a fixed path, as presses are not kept. It
  // ends standing on the stage, or with the character's attack from the ledge.
  if (isLedgeClimb(fighter.action)) {
    const actionFrame = fighter.actionFrame + 1;
    const ledge = fighter.ledge === null ? undefined : stage.ledges[fighter.ledge];
    const climbing: FighterState = {
      ...fighter,
      position: ledge
        ? climbPosition(fighter.action, actionFrame, ledge, character)
        : fighter.position,
      velocity: { x: 0, y: 0 },
      actionFrame,
      buffer: null,
      invulnerableFrames: Math.max(fighter.invulnerableFrames - 1, 0),
      dodgeRestFrames: restFrom(fighter),
      ...techTimers(fighter, false),
      stick,
      previousInput: input,
    };
    const { getup } = LEDGE;
    const attackMove = moves.ledgeAttack;
    const done =
      fighter.action === 'ledgeStand'
        ? actionFrame >= getup.stand.totalFrames
        : fighter.action === 'ledgeRoll'
          ? actionFrame >= getup.roll.totalFrames
          : actionFrame >= getup.attack.climbFrames;
    const onStage: FighterState = {
      ...climbing,
      grounded: true,
      jumpsRemaining: stats.airJumps + 1,
      airDodgeUsed: false,
      ledge: null,
      actionFrame: 0,
      action: 'idle',
    };
    const next: FighterState = !done
      ? climbing
      : fighter.action === 'ledgeAttack' && attackMove !== undefined
        ? { ...onStage, action: 'attack', moveId: attackMove, hitTargets: [] }
        : onStage;
    return { ...next, pose: nextPose(next, frame) };
  }

  // On the ground after a tumble (#158): a tech or getup plays out its frames, a roll travelling
  // at an even speed and stopping at the edge (keeping its facing, unlike a dodge roll); a
  // knockdown bounces, then waits for an option. Presses are not kept, as on a ledge climb.
  if (isDowned(fighter.action)) {
    const actionFrame = fighter.actionFrame + 1;
    const base: FighterState = {
      ...fighter,
      velocity: { x: 0, y: 0 },
      knockback: { x: 0, y: 0 },
      actionFrame,
      buffer: null,
      invulnerableFrames: Math.max(fighter.invulnerableFrames - 1, 0),
      dodgeRestFrames: restFrom(fighter),
      ...techTimers(fighter, false),
      stick,
      previousInput: input,
    };
    const start = (action: Exclude<DownedAction, 'knockdown'>): FighterState => ({
      ...base,
      action,
      actionFrame: 0,
      invulnerableFrames: Math.max(
        base.invulnerableFrames,
        downedFrames(action).invulnerableFrames,
      ),
    });
    let next: FighterState;
    if (fighter.action === 'knockdown') {
      const lying = actionFrame - KNOCKDOWN.bounceFrames;
      const option =
        lying < 0
          ? null
          : lying >= KNOCKDOWN.lieFrames
            ? 'getup'
            : getupOption(input, prev, fighter.facing);
      const attack = moves.getupAttack;
      next =
        option === null
          ? base
          : option !== 'getupAttack'
            ? start(option)
            : attack === undefined
              ? start('getup')
              : {
                  ...base,
                  action: 'attack',
                  moveId: attack,
                  actionFrame: 0,
                  hitTargets: [],
                  invulnerableFrames: Math.max(
                    base.invulnerableFrames,
                    KNOCKDOWN.attack.invulnerableFrames,
                  ),
                };
    } else {
      const { totalFrames, moveTo, distance, way } = downedFrames(fighter.action);
      const support = stage.platforms.find((p) =>
        standsOn(fighter.position.x, fighter.position.y, p),
      );
      const step = actionFrame <= moveTo ? (way * fighter.facing * distance) / moveTo : 0;
      const x = support
        ? Math.min(Math.max(fighter.position.x + step, support.bounds.left), support.bounds.right)
        : fighter.position.x + step;
      next = {
        ...base,
        position: { x, y: fighter.position.y },
        ...(actionFrame >= totalFrames && { action: 'idle' as const, actionFrame: 0 }),
      };
    }
    return { ...next, pose: nextPose(next, frame) };
  }

  // In a grab (#159): the holder stands still and pummels with attack; the held fighter hangs
  // where the simulation puts it, breaking free in time, sooner the more it mashes. The
  // simulation settles the catch, the pummel's hit and the release. Presses are not kept.
  if (fighter.action === 'holding' || fighter.action === 'pummel' || fighter.action === 'grabbed') {
    const actionFrame = fighter.actionFrame + 1;
    const base: FighterState = {
      ...fighter,
      velocity: { x: 0, y: 0 },
      knockback: { x: 0, y: 0 },
      actionFrame,
      buffer: null,
      invulnerableFrames: Math.max(fighter.invulnerableFrames - 1, 0),
      dodgeRestFrames: restFrom(fighter),
      ...techTimers(fighter, false),
      stick,
      previousInput: input,
    };
    const escape = fighter.escapeFrames - 1 - mashes(input, prev) * GRAB.mash.frames;
    const next: FighterState =
      fighter.action === 'grabbed'
        ? { ...base, escapeFrames: Math.max(escape, 0) }
        : fighter.action === 'pummel'
          ? actionFrame >= GRAB.pummel.totalFrames
            ? { ...base, action: 'holding', actionFrame: 0 }
            : base
          : button === 'attack'
            ? { ...base, action: 'pummel', actionFrame: 0 }
            : base;
    return { ...next, pose: nextPose(next, frame) };
  }

  let { x: px, y: py } = fighter.position;
  // The fighter's own speed. What is left of a launch (#153) moves it on top and decays on its
  // own, so gravity and drift act on the fighter while the launch fades, as in Melee.
  let launch = decayLaunch(fighter.knockback);
  let vx = fighter.velocity.x - fighter.knockback.x;
  let vy = fighter.velocity.y - fighter.knockback.y;
  let {
    facing,
    grounded,
    jumpsRemaining,
    airDodgeUsed,
    dodgeStreak,
    turnedFrom,
    actionFrame,
    moveId,
    hitstunFrames,
    landingLagFrames,
    hitTargets,
  } = fighter;
  // Widened again: the fighter can grab a ledge this frame, though it held none before.
  let action: FighterAction = fighter.action;
  let shortHop = fighter.shortHop;
  let lCancelPress = pressLCancel(ageLCancel(fighter.lCancelPress), dodgePress && lCancelling);
  // The tech window (#158): a dodge press in the air opens it, unless a recent press locks it out.
  const timers = techTimers(fighter, dodgePress);
  let { techWindow } = timers;
  const { techLockout } = timers;
  let downInvulnerable = 0;
  let lastLanding = fighter.lastLanding;
  turnedFrom =
    turnedFrom && turnedFrom.age < DODGE.turnGraceFrames
      ? { ...turnedFrom, age: turnedFrom.age + 1 }
      : null;
  // Down with a button is a down attack or a sidestep on the platform, not a drop through it,
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
    jumpsRemaining = Math.min(jumpsRemaining, stats.airJumps);
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
  let buffer = latest(press(grounded), kept && { ...kept, age: kept.age + 1 });
  const slotMove = (wanted: BufferedAction): MoveId | undefined => {
    if (wanted === 'grab') return grounded ? moves[grabSlot(action)] : undefined;
    const id = isDodge(wanted) || wanted === 'jump' ? undefined : moves[wanted];
    // A block starts only on the ground (#50).
    return id !== undefined && !grounded && findMove(id).guard ? undefined : id;
  };
  /** Starts a move from the buffered press, facing the way the press asked for. */
  const startMove = (id: MoveId, face: 1 | -1): void => {
    buffer = null;
    action = 'attack';
    actionFrame = 0;
    moveId = id;
    facing = face;
    hitTargets = [];
    // The turn is settled once a move starts; a roll cancelled out of it must not undo it.
    turnedFrom = null;
  };
  /** The way a buffered press starts its move: a grab the way the fighter faces now (#159). */
  const faceOf = (queued: BufferedInput): 1 | -1 =>
    queued.action !== 'grab'
      ? queued.face
      : action === 'runTurn'
        ? facing === 1
          ? -1
          : 1
        : facing;
  let dodgeStarted = false;
  /** Starts a buffered dodge; `face` is the way a roll travels. */
  const startDodge = (dodge: DodgeKind, face: 1 | -1): void => {
    actionFrame = 0;
    dodgeStarted = true;
    // One more in a row unless the last dodge ended long enough ago (#150).
    // Counted no further than the floor, where later dodges are no weaker.
    dodgeStreak =
      fighter.dodgeRestFrames < DODGE.repeat.wearOffFrames
        ? Math.min(dodgeStreak + 1, DODGE.repeat.maxLevel + 1)
        : 1;
    if (dodge === 'roll') {
      // Towards the facing a forward roll, away from it a back roll, counted from the facing
      // before a turn the stick made just now.
      if (turnedFrom) facing = turnedFrom.facing;
      action = face === facing ? 'forwardRoll' : 'backRoll';
    } else {
      action = dodge;
    }
    // Out of a move it cancels (#52).
    moveId = null;
    hitTargets = [];
    turnedFrom = null;
    buffer = null;
    vx = 0;
    if (dodge === 'airDodge') {
      // Off in the stick's direction, or held in place without one.
      airDodgeUsed = true;
      const tilt = Math.hypot(input.x, input.y);
      const speed = tilt >= DODGE.air.directionStick ? DODGE.air.speed / tilt : 0;
      vx = input.x * speed;
      vy = input.y * speed;
    }
  };
  // An empty slot does nothing: the press is dropped, and a jump on the same frame still counts.
  // So is a dodge that can no longer start: a ground dodge once the fighter left the ground, an
  // air dodge on the ground or used up.
  const bufferedMove = buffer ? slotMove(buffer.action) : undefined;
  const dodgeCanStart = (dodge: BufferedAction): boolean =>
    dodge === 'airDodge' ? !grounded && !airDodgeUsed : grounded;
  const bufferedDodge =
    buffer && isDodge(buffer.action) && dodgeCanStart(buffer.action) ? buffer.action : undefined;
  // A jump without one left is dropped too. A jump pressed with another button counts at once.
  const bufferedJump = (buffer?.action === 'jump' || jumpPressed) && jumpsRemaining > 0;
  if (
    buffer &&
    bufferedMove === undefined &&
    bufferedDodge === undefined &&
    !(buffer.action === 'jump' && bufferedJump) &&
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
    // A `dodge` window (#52) takes whichever dodge can start here.
    const cancel =
      queued &&
      move?.cancels.find(
        (c) =>
          (c.on === queued.action || (c.on === 'dodge' && bufferedDodge !== undefined)) &&
          actionFrame >= c.from &&
          actionFrame < c.to,
      );
    const into = cancel?.into;
    const next =
      cancel && cancel.on !== 'dodge'
        ? into !== undefined && !(findMove(into).guard && !grounded)
          ? into
          : into === undefined
            ? slotMove(cancel.on)
            : undefined
        : undefined;
    const hold = move?.guard?.hold;
    // A block waits with its guard up while special stays held (#50).
    if (hold !== undefined && actionFrame === hold + 1 && input.special) actionFrame = hold;
    if (queued && next !== undefined) {
      startMove(next, queued.face);
    } else if (queued && cancel?.on === 'dodge' && bufferedDodge !== undefined) {
      startDodge(bufferedDodge, queued.face);
    } else if (!move || actionFrame >= move.totalFrames || (move.guard && !grounded)) {
      // A block pushed off the ground ends there; it only guards on the ground.
      // A recovery move that ends in the air leaves the fighter helpless (#44).
      action = grounded ? 'idle' : move?.helpless ? 'helpless' : 'airborne';
      actionFrame = 0;
      moveId = null;
      hitTargets = [];
    }
  } else if (baseDodge(action) !== undefined) {
    // A dodge plays out its frames; a press waits in the buffer. A forward roll ends turned round.
    if (actionFrame >= (dodgeFrames(action, dodgeStreak)?.totalFrames ?? 0)) {
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
  } else if (action === 'helpless') {
    // Helpless (#44): no jump, move or dodge until the fighter lands or grabs a ledge.
    buffer = null;
  } else if (action === 'jumpsquat') {
    // Crouched to jump, as in Melee: an attack pressed now is still a ground attack, so a stick
    // flicked up for an up smash does not lose it to tap-jump.
    if (buffer && bufferedMove !== undefined) {
      startMove(bufferedMove, faceOf(buffer));
    } else if (actionFrame >= stats.jumpSquatFrames || !grounded) {
      // A second press during the squat is not kept for a double jump at take-off.
      if (buffer?.action === 'jump') buffer = null;
      vy = shortHop ? stats.shortHopVelocity : stats.jumpVelocity;
      shortHop = false;
      // This is the ground jump, also when the fighter slid off an edge while crouched, which
      // has used it up already.
      jumpsRemaining = Math.min(jumpsRemaining, stats.airJumps);
      grounded = false;
      action = 'airborne';
      actionFrame = 0;
    }
  } else if (action === 'grabRelease') {
    // Pushed apart after a grab (#159): unable to act for a moment; a press waits in the buffer.
    if (actionFrame >= GRAB.release.frames || !grounded) {
      action = grounded ? 'idle' : 'airborne';
      actionFrame = 0;
    }
  } else if (buffer && bufferedMove !== undefined) {
    startMove(bufferedMove, faceOf(buffer));
  } else if (buffer && bufferedDodge !== undefined) {
    startDodge(bufferedDodge, buffer.face);
  } else if (bufferedJump) {
    // From the buffer, or pressed with another button just now.
    const short = buffer?.action === 'jump' ? buffer.shortHop === true : shortHopPressed;
    if (buffer?.action === 'jump') buffer = null;
    if (grounded) {
      action = 'jumpsquat';
      actionFrame = 0;
      shortHop = short;
    } else {
      vy = stats.airJumpVelocity;
      jumpsRemaining -= 1;
    }
  }

  // A move can set the fighter's speed on its frames (#39): a lunge, or the rise of a recovery.
  const motion =
    action === 'attack' && moveId !== null
      ? findMove(moveId).motion?.find((key) => key.frame === actionFrame)
      : undefined;
  if (motion) {
    if (motion.x !== undefined) vx = facing * motion.x;
    // The ground holds a grounded fighter up, so a downward speed only counts in the air.
    if (motion.y !== undefined && !(grounded && motion.y < 0)) vy = motion.y;
    if (grounded && vy > 0) {
      grounded = false;
      jumpsRemaining = Math.min(jumpsRemaining, stats.airJumps);
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
  } else if (action === 'helpless') {
    // Drifting only, more slowly than under full control.
    const drift = stats.airSpeed * HELPLESS.drift;
    vx =
      Math.abs(vx) > drift
        ? approach(vx, Math.sign(vx) * drift, FIGHTER_RULES.launchDecay)
        : Math.abs(input.x) > 0.1
          ? approach(vx, input.x * drift, stats.airAcceleration)
          : approach(vx, 0, stats.airFriction);
  } else if (!grounded && Math.abs(vx) > stats.airSpeed) {
    vx = approach(vx, Math.sign(vx) * stats.airSpeed, FIGHTER_RULES.launchDecay);
  } else if (grounded && isGroundMovement(action)) {
    // Walk, dash, dash dance, run, skid and pivot (#146).
    const moved = moveOnGround({ action, actionFrame, facing, vx }, input, stick, stats);
    if (moved.facing !== facing) {
      // Turning back to where the fighter faced before the last turn undoes that turn.
      turnedFrom = turnedFrom?.facing === moved.facing ? null : (turnedFrom ?? { facing, age: 0 });
    }
    ({ action, actionFrame, facing, vx } = moved);
  } else if (isControllable(action) || inAerial) {
    if (Math.abs(input.x) > 0.1) {
      vx = approach(vx, input.x * stats.airSpeed, stats.airAcceleration);
    } else {
      vx = approach(vx, 0, stats.airFriction);
    }
  } else {
    vx = approach(vx, 0, grounded ? stats.groundFriction : stats.airFriction);
  }

  // Gravity. Holding down while falling fast-falls, but not in a recovery move (#44).
  const inRecovery = action === 'attack' && moveId !== null && findMove(moveId).helpless === true;
  if (!grounded && !airDodging) {
    const fastFalling =
      (isControllable(action) || (inAerial && !inRecovery)) && wantsDrop && vy < 0;
    // While down is held, a fast fall drops at full fast-fall speed at once, as in Melee, instead
    // of speeding up to it.
    vy = fastFalling ? -stats.fastFallSpeed : Math.max(vy - stats.gravity, -stats.maxFallSpeed);
  }

  const nextX = px + vx + launch.x;
  const nextY = py + vy + launch.y;

  // Landing: feet crossed a platform top from above this frame.
  if (!grounded && vy + launch.y <= 0) {
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
      // The ground stops a launch's fall; along the ground it slides on.
      launch = { x: launch.x, y: 0 };
      grounded = true;
      jumpsRemaining = stats.airJumps + 1;
      airDodgeUsed = false;
      // An aerial, air dodge or jump press still waiting in the buffer is dropped: none of them
      // was meant for the ground.
      const airOnly = (a: BufferedAction) => isAerialSlot(a) || a === 'airDodge' || a === 'jump';
      if (buffer && airOnly(buffer.action)) buffer = null;
      // An aerial lands by its auto-cancel windows and L-cancel; the press is used up either way.
      const aerial =
        action === 'attack' && moveId !== null && isAerial(moveId)
          ? landAerial(findMove(moveId), actionFrame, stats.landingLagFrames, lCancelPress)
          : undefined;
      if (aerial) lastLanding = aerial.how;
      lCancelPress = null;
      // A tumble lands in a tech or a knockdown (#158), and the ground stops what is left of it.
      const downed =
        fighter.tumbling && (action === 'hitstun' || action === 'airborne')
          ? landTumble(techWindow, input, facing)
          : undefined;
      if (downed) {
        action = downed;
        actionFrame = 0;
        vx = 0;
        launch = { x: 0, y: 0 };
        hitstunFrames = 0;
        buffer = null;
        techWindow = 0;
        if (downed !== 'knockdown') downInvulnerable = downedFrames(downed).invulnerableFrames;
      }
      // An aerial or air dodge ends on landing, with its own landing lag; a plain landing has a
      // short one. A launched fighter in hitstun lands without lag.
      const lag = downed
        ? undefined
        : action === 'airborne'
          ? stats.landingLagFrames
          : action === 'helpless'
            ? HELPLESS.landingLagFrames
            : action === 'airDodge'
              ? DODGE.air.landingLag
              : aerial
                ? aerial.lag
                : action === 'attack' && moveId !== null
                  ? aerialLandingLag(findMove(moveId), actionFrame, stats.landingLagFrames)
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
    const half = stats.width / 2;
    const overlaps =
      px + half > b.left &&
      px - half < b.right &&
      py < b.top - 1e-6 &&
      py + stats.height > b.bottom;
    if (!overlaps) continue;
    const pushLeft = px + half - b.left;
    const pushRight = b.right - (px - half);
    const pushDown = py + stats.height - b.bottom;
    const smallest = Math.min(pushLeft, pushRight, pushDown);
    if (smallest === pushDown) {
      py = b.bottom - stats.height;
      vy = Math.min(vy, 0);
      launch = { x: launch.x, y: Math.min(launch.y, 0) };
    } else if (smallest === pushLeft) {
      px = b.left - half;
      vx = Math.min(vx, 0);
      launch = { x: Math.min(launch.x, 0), y: launch.y };
    } else {
      px = b.right + half;
      vx = Math.max(vx, 0);
      launch = { x: Math.max(launch.x, 0), y: launch.y };
    }
  }

  // Off the ground any movement is airborne; ground movement itself is settled above.
  if (isControllable(action)) {
    const next: FighterAction = !grounded ? 'airborne' : action === 'airborne' ? 'idle' : action;
    if (next !== action) {
      action = next;
      actionFrame = 0;
    }
  }

  // A dodge cannot be hit on its invulnerable frames; a longer invulnerability (a respawn) stays.
  const dodge = dodgeFrames(action, dodgeStreak);
  const dodgeInvulnerable =
    dodge !== undefined &&
    actionFrame >= dodge.invulnerableFrom &&
    actionFrame < dodge.invulnerableTo;

  // Falling past a free ledge catches it (#40), unless the stick holds down to fall on. A
  // recovery move catches one on its way down too (#39), as up specials snap to ledges in Smash.
  const regrab = Math.max(fighter.ledgeRegrabFrames - 1, 0);
  const caught =
    !grounded &&
    (action === 'airborne' || action === 'helpless' || inRecovery) &&
    vy + launch.y <= 0 &&
    input.y >= DROP_THRESHOLD &&
    regrab === 0
      ? ledgeInReach(stage, character, { x: px, y: py }, ledgesTaken)
      : null;
  const ledge = caught === null ? undefined : stage.ledges[caught];
  if (ledge) {
    ({ x: px, y: py } = hangPosition(ledge, character));
    vx = 0;
    vy = 0;
    launch = { x: 0, y: 0 };
    facing = ledge.facing;
    action = 'ledge';
    actionFrame = 0;
    // A recovery move caught on its way down ends here.
    moveId = null;
    hitTargets = [];
    turnedFrom = null;
    buffer = null;
    // Holding on gives the air jumps and the air dodge back, as in Ultimate.
    jumpsRemaining = stats.airJumps;
    airDodgeUsed = false;
    lCancelPress = null;
  }

  const moved: FighterState = {
    ...fighter,
    position: { x: px, y: py },
    velocity: { x: vx + launch.x, y: vy + launch.y },
    knockback: launch,
    // A tumble lasts while the fighter only drifts: acting (a jump, a move, a dodge) or landing
    // ends it.
    tumbling:
      fighter.tumbling &&
      !grounded &&
      (action === 'hitstun' ||
        (action === 'airborne' && jumpsRemaining === fighter.jumpsRemaining)),
    facing,
    grounded,
    jumpsRemaining,
    // Only a jump squat under way carries it; one cut short by a move or a hit forgets it.
    shortHop: action === 'jumpsquat' && shortHop,
    airDodgeUsed,
    dodgeStreak,
    // Counted from the frame after the last dodge ended (#150), and no further than it matters.
    dodgeRestFrames: restFrom(fighter, dodgeStarted),
    turnedFrom,
    action,
    actionFrame,
    moveId,
    hitstunFrames,
    landingLagFrames,
    lCancelPress,
    lastLanding,
    hitTargets,
    buffer,
    invulnerableFrames: Math.max(
      fighter.invulnerableFrames - 1,
      dodgeInvulnerable ? 1 : 0,
      ledge ? LEDGE.invulnerableFrames : 0,
      downInvulnerable,
    ),
    techWindow,
    techLockout,
    ledge: ledge ? caught : null,
    ledgeRegrabFrames: regrab,
    stick,
    previousInput: input,
  };
  // Eased before combat, so hurtboxes built from the pose match this frame's body.
  return { ...moved, pose: nextPose(moved, frame) };
};

/**
 * What is left of a launch after one more frame (#153): slower by `KNOCKBACK.decayPerFrame` along
 * its direction, and stopped rather than reversed.
 */
const decayLaunch = ({ x, y }: Vec2): Vec2 => {
  const speed = Math.hypot(x, y);
  if (speed <= KNOCKBACK.decayPerFrame) return { x: 0, y: 0 };
  const scale = (speed - KNOCKBACK.decayPerFrame) / speed;
  return { x: x * scale, y: y * scale };
};
