import { describe, expect, it } from 'vitest';
import { activeHitboxes } from './combat';
import { FIGHTER } from './config';
import { findMove } from './move-data';
import { moveTiming } from './moves';
import type { PressSlot } from './move-slots';
import { CAPSULE, STAGES } from './registry';
import { step } from './simulation';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { FighterState, MatchState, PlayerInput } from './types';

const NONE = inputOf({});

/**
 * The six ground attacks of the capsule (#33): the slot, the input that asks for it (a soft push
 * is a tilt, a flick to the rim a smash), the startup, active and total frames, and where a
 * target stands to be hit by it.
 */
const GROUND_ATTACKS: readonly {
  slot: PressSlot;
  id: string;
  input: PlayerInput;
  timing: [startup: number, active: number, total: number];
  targetX: number;
}[] = [
  {
    slot: 'forwardTilt',
    id: 'forwardTilt',
    input: inputOf({ x: 0.5 }),
    timing: [5, 4, 18],
    targetX: 0.9,
  },
  { slot: 'upTilt', id: 'upTilt', input: inputOf({ y: 0.5 }), timing: [4, 6, 18], targetX: 0.6 },
  {
    slot: 'downTilt',
    id: 'downTilt',
    input: inputOf({ y: -0.5 }),
    timing: [7, 3, 17],
    targetX: 0.9,
  },
  {
    slot: 'forwardSmash',
    id: 'forwardSmash',
    input: inputOf({ x: 1 }),
    timing: [13, 4, 42],
    targetX: 0.9,
  },
  { slot: 'upSmash', id: 'upSmash', input: inputOf({ y: 1 }), timing: [9, 7, 40], targetX: 0.6 },
  {
    slot: 'downSmash',
    id: 'downSmash',
    input: inputOf({ y: -1 }),
    timing: [6, 4, 36],
    targetX: 0.9,
  },
];

/** P1 at the centre of the main stage facing right, P2 standing at `x` with `damage`. */
const faceOff = (x: number, damage = 0): MatchState => {
  let state = withFighter(settled(), 0, {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    grounded: true,
    action: 'idle',
  });
  state = withFighter(state, 1, {
    position: { x, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: x > 0 ? -1 : 1,
    grounded: true,
    action: 'idle',
    damage,
  });
  return state;
};

/** P1 presses attack with the stick at `input` and lets go; runs until the first hit. */
const firstHit = (state: MatchState, input: PlayerInput) => {
  let next = step(state, [{ ...input, attack: true }]);
  const started = fighter(next, 0);
  for (let frame = 1; frame < 60; frame += 1) {
    if (next.events.some((event) => event.type === 'hit')) {
      return { started, attacker: fighter(next, 0), target: fighter(next, 1), state: next };
    }
    next = step(next, [NONE]);
  }
  throw new Error(`${started.moveId ?? 'Nothing'} never hit`);
};

/** Frames until P2 loses a stock through the side or top of the blast zone, or undefined. */
const koFrames = (state: MatchState): number | undefined => {
  let next = state;
  for (let frame = 0; frame < 400; frame += 1) {
    const before = fighter(next, 1).position;
    next = step(next, [NONE]);
    // A fall through the bottom only shows that the target did not try to recover.
    if (fighter(next, 1).falls > 0) {
      return before.y > state.stage.blastZone.bottom + 1 ? frame : undefined;
    }
  }
  return undefined;
};

const launch = (target: FighterState) => {
  const { x, y } = target.velocity;
  return { speed: Math.hypot(x, y), angle: (Math.atan2(y, x) * 180) / Math.PI };
};

describe('ground attacks of the first fighter', () => {
  it.each(GROUND_ATTACKS)('fills the $slot slot with its own move', ({ slot, id }) => {
    expect(CAPSULE.moves[slot]).toBe(id);
    expect(findMove(id).id).toBe(id);
  });

  it.each(GROUND_ATTACKS)('starts $id from its input', ({ id, input }) => {
    const state = step(faceOff(3), [{ ...input, attack: true }]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: id, actionFrame: 0 });
  });

  it('plays the up smash when the stick flicks up, though tap-jump starts a jump first', () => {
    // A pad reports jump as soon as the stick passes the tap-jump line, a frame before attack.
    let state = step(faceOff(3), [inputOf({ y: 1, jump: true })]);
    expect(fighter(state, 0).action).toBe('jumpsquat');
    state = step(state, [inputOf({ y: 1, jump: true, attack: true })]);
    expect(fighter(state, 0)).toMatchObject({
      action: 'attack',
      moveId: 'upSmash',
      grounded: true,
    });
    state = run(state, 30, [inputOf({ y: 1, jump: true })]);
    expect(fighter(state, 0).grounded).toBe(true);
  });

  it('plays the up smash for attack on the last frame of the jump squat too', () => {
    let state = step(faceOff(3), [inputOf({ y: 1, jump: true })]);
    state = run(state, FIGHTER.jumpSquatFrames - 1, [inputOf({ y: 1, jump: true })]);
    expect(fighter(state, 0)).toMatchObject({ action: 'jumpsquat', grounded: true });
    state = step(state, [inputOf({ y: 1, jump: true, attack: true })]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: 'upSmash' });
  });

  it.each([
    ['jab', 14],
    ['jab2', 14],
    ['jab3', 22],
  ] as const)('%s recovers quickly, like the other weak attacks (%i frames)', (id, total) => {
    expect(findMove(id).totalFrames).toBe(total);
  });

  it.each(GROUND_ATTACKS)('$id has its frame data', ({ id, timing }) => {
    const [startupFrames, activeFrames, totalFrames] = timing;
    expect(moveTiming(findMove(id))).toEqual({ startupFrames, activeFrames, totalFrames });
  });

  it.each(GROUND_ATTACKS)(
    '$id hits a target in reach on its first active frame, and only then',
    ({ id, input, timing, targetX }) => {
      const { attacker, target } = firstHit(faceOff(targetX), input);
      expect(attacker.moveId).toBe(id);
      expect(attacker.actionFrame).toBe(timing[0]);
      expect(target.action).toBe('hitstun');
      expect(target.damage).toBeGreaterThan(0);
    },
  );

  it.each(GROUND_ATTACKS)('$id plays out and hands control back', ({ id, input, timing }) => {
    let state = step(faceOff(3), [{ ...input, attack: true }]);
    state = run(state, timing[2] - 1, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: id });
    expect(activeHitboxes(fighter(state, 0))).toEqual([]);
    state = step(state, [NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'idle', moveId: null });
  });
});

describe('ground attack knockback', () => {
  const byId = (id: string) => {
    const attack = GROUND_ATTACKS.find((entry) => entry.id === id);
    if (!attack) throw new Error(`No ground attack ${id}`);
    return attack;
  };
  const hit = (id: string, damage = 0, targetX = byId(id).targetX) =>
    firstHit(faceOff(targetX, damage), byId(id).input).target;

  it('sends forward attacks forward and up attacks almost straight up', () => {
    for (const id of ['forwardTilt', 'forwardSmash', 'downSmash']) {
      const { angle } = launch(hit(id));
      expect(angle, id).toBeGreaterThan(15);
      expect(angle, id).toBeLessThan(45);
    }
    for (const id of ['upTilt', 'upSmash', 'downTilt']) {
      expect(launch(hit(id)).angle, id).toBeGreaterThan(70);
    }
  });

  it('launches the other way when the attacker faces left', () => {
    const mirrored = (id: string) => {
      let state = withFighter(faceOff(-byId(id).targetX), 0, { facing: -1 });
      state = withFighter(state, 1, { facing: 1 });
      const input = { ...byId(id).input, x: -byId(id).input.x };
      return firstHit(state, input).target;
    };
    for (const id of ['forwardTilt', 'forwardSmash']) {
      expect(mirrored(id).velocity.x).toBeCloseTo(-hit(id).velocity.x, 9);
    }
  });

  it('hits behind with the down smash and sends that target backwards', () => {
    const behind = hit('downSmash', 0, -0.9);
    expect(behind.velocity.x).toBeLessThan(0);
    expect(behind.velocity.y).toBeGreaterThan(0);
  });

  it('launches harder with a smash than with the tilt in the same direction', () => {
    for (const [tilt, smash] of [
      ['forwardTilt', 'forwardSmash'],
      ['upTilt', 'upSmash'],
      ['downTilt', 'downSmash'],
    ] as const) {
      expect(launch(hit(smash, 50)).speed).toBeGreaterThan(launch(hit(tilt, 50)).speed);
      expect(hit(smash).damage).toBeGreaterThan(hit(tilt).damage);
    }
  });

  it.each(STAGES.map((stage) => [stage.id, stage] as const))(
    'KOs from the centre of %s with a smash at high damage, but not at low damage',
    (_id, stage) => {
      const on = (damage: number, id: string) => ({
        ...faceOff(byId(id).targetX, damage),
        stage,
      });
      for (const id of ['forwardSmash', 'upSmash', 'downSmash']) {
        expect(koFrames(firstHit(on(140, id), byId(id).input).state), id).toBeDefined();
        expect(koFrames(firstHit(on(40, id), byId(id).input).state), id).toBeUndefined();
      }
    },
  );

  it('sends a fighter off-stage at mid damage without a KO, so the fight goes on out there', () => {
    const state = firstHit(
      faceOff(byId('forwardSmash').targetX, 60),
      byId('forwardSmash').input,
    ).state;
    const edge = Math.max(...state.stage.platforms.map((p) => p.bounds.right));
    let next = state;
    let furthest = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      next = step(next, [NONE]);
      furthest = Math.max(furthest, fighter(next, 1).position.x);
    }
    expect(furthest).toBeGreaterThan(edge + 3);
    expect(koFrames(state)).toBeUndefined();
    // Holding back towards the stage and jumping once hitstun ends brings it home.
    let back = state;
    while (fighter(back, 1).action === 'hitstun' || fighter(back, 1).hitlagFrames > 0) {
      back = step(back, [NONE]);
    }
    back = step(back, [NONE, inputOf({ x: -1, jump: true })]);
    for (let frame = 0; frame < 300 && !fighter(back, 1).grounded; frame += 1) {
      back = step(back, [NONE, inputOf({ x: -1 })]);
    }
    expect(fighter(back, 1)).toMatchObject({ grounded: true, falls: 0 });
  });

  it.each([
    ['forwardSmash', 90, 120],
    ['upSmash', 105, 135],
    ['downSmash', 100, 130],
  ] as const)('%s KOs from the centre between %i and %i percent', (id, safe, kills) => {
    const at = (damage: number) =>
      firstHit(faceOff(byId(id).targetX, damage), byId(id).input).state;
    expect(koFrames(at(safe))).toBeUndefined();
    expect(koFrames(at(kills))).toBeDefined();
  });

  it('keeps the jab finisher from KOing at the damage where smashes do', () => {
    let state = withFighter(faceOff(0.8, 140), 0, {
      action: 'attack',
      moveId: 'jab3',
      actionFrame: 0,
    });
    while (!state.events.some((event) => event.type === 'hit')) state = step(state, [NONE]);
    expect(fighter(state, 1).damage).toBeGreaterThan(140);
    expect(koFrames(state)).toBeUndefined();
  });

  it('keeps tilts from KOing at the damage where smashes do', () => {
    for (const id of ['forwardTilt', 'upTilt', 'downTilt']) {
      const state = firstHit(faceOff(byId(id).targetX, 140), byId(id).input).state;
      expect(koFrames(state), id).toBeUndefined();
    }
  });
});
