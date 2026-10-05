import { describe, expect, it } from 'vitest';
import { KNOCKDOWN, TECH } from './config';
import { CAPSULE } from './registry';
import { createMatch, step } from './simulation';
import { FINAL_DESTINATION } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { FighterState, MatchState, PlayerInput } from './types';

const NONE = inputOf({});

/** P1 idle far left on Final Destination; P2, facing left, tumbling down onto the stage at x 2. */
const tumbling = (): MatchState => {
  let state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );
  state = withFighter(state, 0, {
    position: { x: -5, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    grounded: true,
    action: 'idle',
  });
  return withFighter(state, 1, {
    // Launched straight up, so it falls back onto the same spot a while later.
    position: { x: 2, y: 1 },
    velocity: { x: 0, y: 0.6 },
    knockback: { x: 0, y: 0.6 },
    facing: -1,
    grounded: false,
    action: 'hitstun',
    actionFrame: 0,
    hitstunFrames: 90,
    tumbling: true,
  });
};

/** The step on which P2 lands, counted from 1, when nobody presses anything. */
const LANDING = (() => {
  let state = tumbling();
  for (let frame = 1; frame <= 200; frame += 1) {
    state = step(state, [NONE, NONE]);
    if (fighter(state, 1).grounded) return frame;
  }
  throw new Error('Never landed');
})();

/** P2 falls with `p2(frame)` held on each step until it lands; the state on the landing step. */
const fallWith = (p2: (frame: number) => PlayerInput): MatchState => {
  let state = tumbling();
  for (let frame = 1; frame <= LANDING; frame += 1) state = step(state, [NONE, p2(frame)]);
  return state;
};

/** P2 pressing dodge on each of `frames` (counted from 1), and holding `stick` as it lands. */
const pressingOn =
  (frames: readonly number[], stick: Partial<PlayerInput> = {}) =>
  (frame: number): PlayerInput =>
    inputOf({ ...(frame >= LANDING - 1 && stick), shield: frames.includes(frame) });

/** Steps on with `p2` held until P2 is back to `idle`; each frame's P2 on the way, this one first. */
const playOut = (state: MatchState, p2: PlayerInput = NONE, limit = 300): FighterState[] => {
  const frames = [fighter(state, 1)];
  let now = state;
  for (let i = 0; i < limit && fighter(now, 1).action !== 'idle'; i += 1) {
    now = step(now, [NONE, p2]);
    frames.push(fighter(now, 1));
  }
  return frames;
};

const invulnerable = (frames: readonly FighterState[]) =>
  frames.filter((f) => f.invulnerableFrames > 0).length;

describe('teching a tumble (#158)', () => {
  it('lands the test tumble after a while, so a press can come early or late', () => {
    expect(LANDING).toBeGreaterThan(TECH.lockoutFrames + 10);
  });

  it(`techs in place for a press up to ${TECH.windowFrames} frames before landing`, () => {
    const landed = fallWith(pressingOn([LANDING - (TECH.windowFrames - 1)]));
    expect(fighter(landed, 1)).toMatchObject({ action: 'tech', grounded: true, tumbling: false });
    expect(fighter(landed, 1).velocity).toEqual({ x: 0, y: 0 });
    const frames = playOut(landed);
    // In place, invulnerable at first, then open to a tech chase until it can act.
    expect(frames.every((f) => f.position.x === 2)).toBe(true);
    expect(frames.length - 1).toBe(TECH.inPlace.totalFrames);
    expect(invulnerable(frames)).toBe(TECH.inPlace.invulnerableFrames);
  });

  it('also techs for a press on the landing frame itself', () => {
    expect(fighter(fallWith(pressingOn([LANDING])), 1).action).toBe('tech');
  });

  it.each([
    ['forward', -1, 'techForward'],
    ['back', 1, 'techBack'],
  ] as const)('tech rolls %s with the stick held that way', (_, x, action) => {
    const landed = fallWith(pressingOn([LANDING - 5], { x }));
    expect(fighter(landed, 1).action).toBe(action);
    const frames = playOut(landed);
    expect(frames.length - 1).toBe(TECH.roll.totalFrames);
    expect(invulnerable(frames)).toBe(TECH.roll.invulnerableFrames);
    // P2 faces left: forward is to the left.
    const end = frames.at(-1)?.position.x ?? 0;
    expect(end).toBeCloseTo(2 + x * TECH.roll.distance, 9);
  });

  it(`misses with a press more than ${TECH.windowFrames} frames before landing`, () => {
    expect(fighter(fallWith(pressingOn([LANDING - TECH.windowFrames])), 1).action).toBe(
      'knockdown',
    );
  });

  it('locks out a second press soon after the first, so mashing fails', () => {
    const mashed = pressingOn([LANDING - 30, LANDING - 5]);
    expect(fighter(fallWith(mashed), 1).action).toBe('knockdown');
    const waited = pressingOn([LANDING - 5 - TECH.lockoutFrames, LANDING - 5]);
    expect(fighter(fallWith(waited), 1).action).toBe('tech');
  });

  it('counts a press while frozen by the hit, for a tumble that lands right after the freeze', () => {
    // A spike on a fighter near the ground: it lands a frame or two after the freeze.
    let state = withFighter(tumbling(), 1, {
      position: { x: 2, y: 0.3 },
      velocity: { x: 0, y: -0.4 },
      knockback: { x: 0, y: -0.4 },
      hitlagFrames: 6,
    });
    for (let frame = 1; frame <= 20 && !fighter(state, 1).grounded; frame += 1) {
      state = step(state, [NONE, inputOf({ shield: frame === 3 })]);
    }
    expect(fighter(state, 1).action).toBe('tech');
  });

  it('lets the lockout run out while hanging from a ledge, so a later tumble can tech', () => {
    const hanging = withFighter(tumbling(), 1, {
      action: 'ledge',
      actionFrame: 0,
      ledge: 0,
      grounded: false,
      velocity: { x: 0, y: 0 },
      knockback: { x: 0, y: 0 },
      tumbling: false,
      techWindow: TECH.windowFrames,
      techLockout: TECH.lockoutFrames,
    });
    const later = run(hanging, TECH.lockoutFrames, [NONE, NONE]);
    expect(fighter(later, 1).action).toBe('ledge');
    expect(fighter(later, 1)).toMatchObject({ techWindow: 0, techLockout: 0 });
  });

  it('lands as before from a hit that did not make it tumble', () => {
    const flinched = withFighter(tumbling(), 1, { tumbling: false });
    let state = flinched;
    for (let i = 0; i < 200 && !fighter(state, 1).grounded; i += 1) {
      state = step(state, [NONE, NONE]);
    }
    expect(fighter(state, 1).action).toBe('hitstun');
  });
});

describe('knockdown and getups (#158)', () => {
  const knockedDown = (): MatchState => fallWith(() => NONE);

  it('knocks a fighter down when it misses the tech, open to hits while it bounces', () => {
    const landed = knockedDown();
    expect(fighter(landed, 1)).toMatchObject({
      action: 'knockdown',
      grounded: true,
      tumbling: false,
      invulnerableFrames: 0,
    });
    expect(fighter(landed, 1).velocity).toEqual({ x: 0, y: 0 });
  });

  it(`ignores getup input for the ${KNOCKDOWN.bounceFrames} frame bounce`, () => {
    const up = inputOf({ y: 1 });
    const bounced = run(knockedDown(), KNOCKDOWN.bounceFrames - 1, [NONE, up]);
    expect(fighter(bounced, 1).action).toBe('knockdown');
    expect(fighter(step(bounced, [NONE, up]), 1).action).toBe('getup');
  });

  it('gets up with the short hop button too, like a jump', () => {
    const bounced = run(knockedDown(), KNOCKDOWN.bounceFrames - 1);
    expect(fighter(step(bounced, [NONE, inputOf({ shortHop: true })]), 1).action).toBe('getup');
  });

  it('gets up on its own after lying too long', () => {
    const lying = run(knockedDown(), KNOCKDOWN.bounceFrames + KNOCKDOWN.lieFrames - 1);
    expect(fighter(lying, 1).action).toBe('knockdown');
    expect(fighter(step(lying, [NONE, NONE]), 1).action).toBe('getup');
  });

  /** Knocked down, through the bounce, then `option` held: the frames from the getup on. */
  const getup = (option: PlayerInput): FighterState[] => {
    let state = run(knockedDown(), KNOCKDOWN.bounceFrames - 1);
    state = step(state, [NONE, option]);
    return playOut(state);
  };

  it('stands up in place with the stick up', () => {
    const frames = getup(inputOf({ y: 1 }));
    expect(frames[0]?.action).toBe('getup');
    expect(frames.every((f) => f.position.x === 2)).toBe(true);
    expect(frames.length - 1).toBe(KNOCKDOWN.getup.totalFrames);
    expect(invulnerable(frames)).toBe(KNOCKDOWN.getup.invulnerableFrames);
  });

  it.each([
    ['forward', -1, 'getupForward'],
    ['back', 1, 'getupBack'],
  ] as const)('rolls %s with the stick held that way', (_, x, action) => {
    const frames = getup(inputOf({ x }));
    expect(frames[0]?.action).toBe(action);
    expect(frames.length - 1).toBe(KNOCKDOWN.roll.totalFrames);
    expect(invulnerable(frames)).toBe(KNOCKDOWN.roll.invulnerableFrames);
    expect(frames.at(-1)?.position.x).toBeCloseTo(2 + x * KNOCKDOWN.roll.distance, 9);
  });

  it.each([
    ['in front of', 1.2],
    ['behind', 2.8],
  ])('attacks out of the knockdown, hitting someone %s it', (_, x) => {
    let state = withFighter(knockedDown(), 0, { position: { x, y: 0 } });
    state = run(state, KNOCKDOWN.bounceFrames - 1);
    state = step(state, [NONE, inputOf({ attack: true })]);
    expect(fighter(state, 1)).toMatchObject({ action: 'attack', moveId: 'getupAttack' });
    expect(fighter(state, 1).invulnerableFrames).toBe(KNOCKDOWN.attack.invulnerableFrames);
    let hit = false;
    for (let i = 0; i < 60 && !hit; i += 1) {
      state = step(state, [NONE, NONE]);
      hit = state.events.some((e) => e.type === 'hit' && e.attacker === 1);
    }
    expect(hit).toBe(true);
  });
});
