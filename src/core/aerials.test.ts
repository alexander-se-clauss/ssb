import { describe, expect, it } from 'vitest';
import { activeHitboxes } from './combat';
import { FIGHTER, INPUT } from './config';
import { findMove } from './move-data';
import { moveTiming } from './moves';
import type { PressSlot } from './move-slots';
import { CAPSULE } from './registry';
import { step } from './simulation';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { FighterState, MatchState, PlayerInput } from './types';

const NONE = inputOf({});

/**
 * The five aerials of the capsule (#34): the input for a fighter facing right, the startup,
 * active and total frames, the landing lag, and where a target is hit from (relative to the
 * attacker, both falling side by side).
 */
const AERIALS: readonly {
  slot: PressSlot;
  id: string;
  input: PlayerInput;
  timing: [startup: number, active: number, total: number];
  landingLag: number;
  target: { x: number; y: number };
}[] = [
  {
    slot: 'neutralAir',
    id: 'neutralAir',
    input: inputOf({}),
    timing: [4, 20, 36],
    landingLag: 6,
    target: { x: 0.9, y: 0 },
  },
  {
    slot: 'forwardAir',
    id: 'forwardAir',
    input: inputOf({ x: 0.5 }),
    timing: [7, 4, 36],
    landingLag: 12,
    target: { x: 0.9, y: 0 },
  },
  {
    slot: 'backAir',
    id: 'backAir',
    input: inputOf({ x: -0.5 }),
    timing: [6, 4, 30],
    landingLag: 9,
    target: { x: -0.9, y: 0 },
  },
  {
    slot: 'upAir',
    id: 'upAir',
    input: inputOf({ y: 0.5 }),
    timing: [5, 5, 32],
    landingLag: 9,
    target: { x: 0.2, y: 1.3 },
  },
  {
    slot: 'downAir',
    id: 'downAir',
    input: inputOf({ y: -0.5 }),
    timing: [8, 5, 40],
    landingLag: 15,
    target: { x: 0, y: -1.5 },
  },
];

const byId = (id: string) => {
  const aerial = AERIALS.find((entry) => entry.id === id);
  if (!aerial) throw new Error(`No aerial ${id}`);
  return aerial;
};

/** P1 `height` above the stage centre facing right, at rest in the air; P2 at `target` from it. */
const inTheAir = (target = { x: 3, y: 0 }, damage = 0, height = 8): MatchState => {
  const airborne = (x: number, y: number): Partial<FighterState> => ({
    position: { x, y },
    velocity: { x: 0, y: 0 },
    grounded: false,
    action: 'airborne',
    jumpsRemaining: 0,
  });
  let state = withFighter(settled(), 0, { ...airborne(0, height), facing: 1 });
  state = withFighter(state, 1, {
    ...airborne(target.x, height + target.y),
    facing: target.x > 0 ? -1 : 1,
    damage,
  });
  return state;
};

/** P1 presses attack with the stick at `input`; runs until the first hit. */
const firstHit = (state: MatchState, input: PlayerInput) => {
  let next = step(state, [{ ...input, attack: true }]);
  for (let frame = 1; frame < 60; frame += 1) {
    if (next.events.some((event) => event.type === 'hit')) {
      return { attacker: fighter(next, 0), target: fighter(next, 1) };
    }
    next = step(next, [NONE]);
  }
  throw new Error(`${fighter(next, 0).moveId ?? 'Nothing'} never hit`);
};

/** P1 at rest in the air, `height` above the main stage, facing right. */
const aboveStage = (height: number): MatchState =>
  withFighter(settled(), 0, {
    position: { x: 0, y: height },
    velocity: { x: 0, y: 0 },
    grounded: false,
    action: 'airborne',
    facing: 1,
  });

/** Steps with no input until P1 is on the ground. */
const untilLanded = (state: MatchState): MatchState => {
  let next = state;
  for (let i = 0; i < 120 && !fighter(next, 0).grounded; i += 1) next = step(next, [NONE]);
  return next;
};

describe('aerials of the first fighter', () => {
  it.each(AERIALS)('fills the $slot slot with its own move', ({ slot, id }) => {
    expect(CAPSULE.moves[slot]).toBe(id);
  });

  it.each(AERIALS)('starts $id from its input in the air', ({ id, input }) => {
    const state = step(inTheAir(), [{ ...input, attack: true }]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: id, grounded: false });
  });

  it('reads forward and back relative to facing, and never turns around', () => {
    const facingLeft = withFighter(inTheAir(), 0, { facing: -1 });
    const back = step(facingLeft, [inputOf({ x: 0.5, attack: true })]);
    expect(fighter(back, 0)).toMatchObject({ moveId: 'backAir', facing: -1 });
    const forward = step(facingLeft, [inputOf({ x: -0.5, attack: true })]);
    expect(fighter(forward, 0)).toMatchObject({ moveId: 'forwardAir', facing: -1 });
  });

  it.each(AERIALS)('$id has its frame data and landing lag', ({ id, timing, landingLag }) => {
    const [startupFrames, activeFrames, totalFrames] = timing;
    expect(moveTiming(findMove(id))).toEqual({ startupFrames, activeFrames, totalFrames });
    expect(findMove(id).landingLag).toBe(landingLag);
  });

  it.each(AERIALS)(
    '$id hits a target in reach on its first active frame',
    ({ id, input, timing, target }) => {
      const { attacker, target: hit } = firstHit(inTheAir(target), input);
      expect(attacker.moveId).toBe(id);
      expect(attacker.actionFrame).toBe(timing[0]);
      expect(hit.action).toBe('hitstun');
    },
  );

  it('plays out in the air and hands control back', () => {
    const { timing } = byId('neutralAir');
    // Off to the side, clear of the platforms, so it does not land before the end.
    const clear = withFighter(inTheAir(), 0, { position: { x: 6, y: 14 } });
    let state = step(clear, [inputOf({ attack: true })]);
    state = run(state, timing[2] - 1, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: 'neutralAir' });
    state = step(state, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'airborne', moveId: null });
  });
});

describe('moving during an aerial', () => {
  it('drifts with the stick and fast-falls, as in the air without an attack', () => {
    const clear = withFighter(inTheAir(), 0, { position: { x: 6, y: 10 } });
    const attacking = step(clear, [inputOf({ attack: true })]);
    const drifted = run(attacking, 10, [inputOf({ x: 1 })]);
    expect(fighter(drifted, 0).action).toBe('attack');
    expect(fighter(drifted, 0).velocity.x).toBeGreaterThan(0.05);
    // Falling, then down: a fast fall, still mid-aerial.
    const falling = run(attacking, 20, [NONE]);
    const fast = run(falling, 3, [inputOf({ y: -1 })]);
    expect(fighter(fast, 0).action).toBe('attack');
    expect(fighter(fast, 0).velocity.y).toBeLessThan(-FIGHTER.maxFallSpeed);
  });
});

describe('ground moves off an edge', () => {
  it('do not drift or fast-fall when one slides off the stage: only aerials steer', () => {
    let state = withFighter(settled(), 0, {
      position: { x: 6.9, y: 0 },
      velocity: { x: 0.12, y: 0 },
      grounded: true,
      action: 'idle',
      facing: 1,
    });
    state = step(state, [inputOf({ x: 1, attack: true })]);
    expect(fighter(state, 0).moveId).toBe('forwardSmash');
    state = run(state, 20, [inputOf({ x: -1, y: -1 })]);
    const smash = fighter(state, 0);
    expect(smash).toMatchObject({ moveId: 'forwardSmash', grounded: false });
    // Only air friction slows it; drifting back would have turned it around by now.
    expect(smash.velocity.x).toBeGreaterThan(0.03);
    expect(smash.velocity.y).toBeGreaterThanOrEqual(-FIGHTER.maxFallSpeed);
  });
});

describe('aerial knockback', () => {
  const launchOf = (id: string, damage = 0) => {
    const { input, target } = byId(id);
    return firstHit(inTheAir(target, damage), input).target.velocity;
  };

  it('sends neutral and forward aerials forward, and the back aerial backwards', () => {
    for (const id of ['neutralAir', 'forwardAir']) {
      expect(launchOf(id).x, id).toBeGreaterThan(0);
      expect(launchOf(id).y, id).toBeGreaterThan(0);
    }
    expect(launchOf('backAir').x).toBeLessThan(0);
    expect(launchOf('backAir').y).toBeGreaterThan(0);
  });

  it('sends the up aerial up and spikes with the down aerial', () => {
    const up = launchOf('upAir');
    expect(up.y).toBeGreaterThan(Math.abs(up.x) * 3);
    const down = launchOf('downAir');
    expect(down.y).toBeLessThan(0);
    expect(Math.abs(down.x)).toBeLessThan(Math.abs(down.y) / 3);
  });

  it.each([
    // Still true with the Melee-near air physics (#145); the up air was strengthened for it.
    ['backAir', 110, 140],
    ['forwardAir', 115, 145],
    ['upAir', 110, 140],
    ['neutralAir', 140, 170],
  ] as const)(
    '%s from a short hop over the centre KOs between %i and %i percent (#42)',
    (id, safe, kills) => {
      const { input, target } = byId(id);
      /** Whether P2 leaves through the side or top of the blast zone. */
      const kos = (damage: number): boolean => {
        let state = step(inTheAir(target, damage, 1.5), [{ ...input, attack: true }]);
        for (let frame = 0; frame < 500; frame += 1) {
          const before = fighter(state, 1).position;
          state = step(state, [NONE]);
          if (fighter(state, 1).falls > 0) return before.y > state.stage.blastZone.bottom + 1;
        }
        return false;
      };
      expect(kos(safe)).toBe(false);
      expect(kos(kills)).toBe(true);
    },
  );

  it('mirrors the launch when the attacker faces left', () => {
    const { input, target } = byId('backAir');
    let state = inTheAir({ x: -target.x, y: target.y });
    state = withFighter(state, 0, { facing: -1 });
    state = withFighter(state, 1, { facing: -1 });
    const mirrored = firstHit(state, { ...input, x: -input.x }).target.velocity;
    expect(mirrored.x).toBeCloseTo(-launchOf('backAir').x, 9);
  });
});

describe('landing lag', () => {
  it('lands out of an aerial into its landing lag, and only then can act', () => {
    const { landingLag } = byId('downAir');
    // Low enough that the aerial is still running when the fighter lands.
    let state = step(aboveStage(0.6), [inputOf({ y: -0.5, attack: true })]);
    state = untilLanded(state);
    expect(fighter(state, 0)).toMatchObject({ action: 'landing', moveId: null, grounded: true });
    expect(fighter(state, 0).landingLagFrames).toBe(landingLag);
    state = run(state, landingLag - 1, [NONE]);
    expect(fighter(state, 0).action).toBe('landing');
    state = step(state, [NONE]);
    expect(fighter(state, 0).action).toBe('idle');
  });

  it('ends the aerial and its hitboxes on landing', () => {
    let state = step(aboveStage(0.6), [inputOf({ attack: true })]);
    state = untilLanded(state);
    expect(fighter(state, 0).moveId).toBeNull();
    expect(fighter(state, 0).action).toBe('landing');
    expect(activeHitboxes(fighter(state, 0))).toEqual([]);
  });

  it('auto-cancels an aerial started just before landing, as in Melee (#148)', () => {
    let state = aboveStage(0.6);
    // Fall until one frame before touching down, then attack.
    for (let i = 0; i < 60 && !fighter(step(state, [NONE]), 0).grounded; i += 1) {
      state = step(state, [NONE]);
    }
    state = step(state, [inputOf({ y: -0.5, attack: true })]);
    // Its first frames are an auto-cancel window: only the normal landing lag.
    expect(fighter(state, 0)).toMatchObject({
      action: 'landing',
      landingLagFrames: FIGHTER.landingLagFrames,
    });
  });

  it('drops an aerial press still in the buffer on landing, so no aerial plays on the ground', () => {
    // Pressed in hitstun just before landing, so it waits in the buffer as an aerial.
    let state = withFighter(aboveStage(0.1), 0, { action: 'hitstun', hitstunFrames: 4 });
    state = step(state, [inputOf({ attack: true })]);
    expect(fighter(state, 0).buffer).toMatchObject({ action: 'neutralAir' });
    state = untilLanded(state);
    expect(fighter(state, 0).buffer).toBeNull();
    state = run(state, INPUT.bufferFrames + 4, [NONE]);
    expect(fighter(state, 0).moveId).toBeNull();
  });

  it('lets the fighter fall freely when it slides off an edge during landing lag', () => {
    let state = untilLanded(step(aboveStage(0.6), [inputOf({ y: -0.5, attack: true })]));
    expect(fighter(state, 0).action).toBe('landing');
    // Still sliding from the landing, close to the edge of the main stage (x = 7).
    state = withFighter(state, 0, { position: { x: 6.9, y: 0 }, velocity: { x: 0.2, y: 0 } });
    state = run(state, 2, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ grounded: false, action: 'airborne' });
    expect(fighter(state, 0).landingLagFrames).toBe(0);
  });

  it('has a short normal landing lag when no aerial is running', () => {
    let state = untilLanded(aboveStage(3));
    expect(fighter(state, 0)).toMatchObject({
      action: 'landing',
      landingLagFrames: FIGHTER.landingLagFrames,
    });
    state = run(state, FIGHTER.landingLagFrames, [NONE]);
    expect(fighter(state, 0).action).toBe('idle');
    expect(FIGHTER.landingLagFrames).toBeLessThan(
      Math.min(...AERIALS.map((aerial) => aerial.landingLag)),
    );
  });

  it('plays a press buffered at the end of the landing lag right after it', () => {
    let state = untilLanded(aboveStage(3));
    state = run(state, FIGHTER.landingLagFrames - 2, [NONE]);
    state = step(state, [inputOf({ attack: true })]);
    expect(fighter(state, 0).action).toBe('landing');
    state = run(state, 2, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: 'jab' });
  });

  it('has no landing lag when a launched fighter lands in hitstun', () => {
    const launched = withFighter(aboveStage(0.5), 0, { action: 'hitstun', hitstunFrames: 60 });
    expect(fighter(untilLanded(launched), 0).action).toBe('hitstun');
  });
});
