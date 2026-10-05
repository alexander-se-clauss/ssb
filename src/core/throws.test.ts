import { describe, expect, it } from 'vitest';
import { findMove } from './move-data';
import { CAPSULE, RIVET, VELA } from './registry';
import { createMatch, step } from './simulation';
import { FINAL_DESTINATION } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, PlayerInput } from './types';

const NONE = inputOf({});
const GRAB_PRESS = inputOf({ grab: true });
const FORWARD = inputOf({ x: 1 });
const BACK = inputOf({ x: -1 });
const UP = inputOf({ y: 1 });
const DOWN = inputOf({ y: -1 });

/** P1 (a capsule) at `x` on Final Destination facing `facing`, holding P2 (`target`) at `damage`. */
const holding = ({
  target = CAPSULE.id,
  damage = 0,
  x = 0,
  facing = 1 as 1 | -1,
  players = 2,
} = {}): MatchState => {
  let state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [
        { characterId: CAPSULE.id },
        { characterId: target },
        ...Array.from({ length: players - 2 }, () => ({ characterId: CAPSULE.id })),
      ],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );
  const placed = { velocity: { x: 0, y: 0 }, grounded: true, action: 'idle' as const };
  state = withFighter(state, 0, { ...placed, position: { x, y: 0 }, facing });
  state = withFighter(state, 1, {
    ...placed,
    position: { x: x + facing * 0.8, y: 0 },
    facing: facing === 1 ? -1 : 1,
    damage,
  });
  // A third player, if any, waits out of reach.
  if (players > 2) state = withFighter(state, 2, { ...placed, position: { x: -6, y: 0 } });
  state = step(state, [GRAB_PRESS, NONE]);
  for (let i = 0; i < 30 && fighter(state, 0).action === 'attack'; i += 1) {
    state = step(state, [NONE, NONE]);
  }
  if (fighter(state, 0).action !== 'holding') throw new Error('The grab did not catch');
  return state;
};

/** P1 throws with `stick`; the state on the frame the throw lets go of P2. */
const thrown = (state: MatchState, stick: PlayerInput, p2: PlayerInput = NONE): MatchState => {
  let now = step(state, [stick, p2]);
  for (let i = 0; i < 60 && fighter(now, 1).action === 'grabbed'; i += 1) {
    now = step(now, [NONE, p2]);
  }
  return now;
};

/** The launch once P2's hitlag from the throw is over, so DI has turned it. */
const launchOf = (state: MatchState, p2: PlayerInput = NONE) => {
  let now = state;
  while (fighter(now, 1).hitlagFrames > 0) now = step(now, [NONE, p2]);
  return fighter(now, 1).knockback;
};

describe('throws (#160)', () => {
  it.each([
    ['forward', FORWARD, 'forwardThrow'],
    ['back', BACK, 'backThrow'],
    ['up', UP, 'upThrow'],
    ['down', DOWN, 'downThrow'],
  ] as const)('throws %s with the stick pushed that way while holding', (_, stick, move) => {
    const state = step(holding(), [stick, NONE]);
    expect(fighter(state, 0)).toMatchObject({ action: 'attack', moveId: move });
    expect(fighter(state, 1).action).toBe('grabbed');
  });

  it('throws forward low along the stage, towards the ledge in front', () => {
    const state = thrown(holding({ damage: 40 }), FORWARD);
    expect(fighter(state, 1)).toMatchObject({ action: 'hitstun', heldBy: null });
    expect(fighter(state, 0).holding).toBeNull();
    const launch = launchOf(state);
    expect(launch.x).toBeGreaterThan(0);
    expect(launch.x).toBeGreaterThan(launch.y);
  });

  it('throws back behind the thrower, from behind it', () => {
    const state = thrown(holding({ damage: 40 }), BACK);
    expect(fighter(state, 1).position.x).toBeLessThan(fighter(state, 0).position.x);
    expect(launchOf(state).x).toBeLessThan(0);
  });

  it('throws up nearly straight up', () => {
    const launch = launchOf(thrown(holding({ damage: 40 }), UP));
    expect(launch.y).toBeGreaterThan(3 * Math.abs(launch.x));
  });

  it.each([0, 60, 120])(
    'throws down into the ground at %i%%, a knockdown right in front for a tech chase',
    (damage) => {
      let state = thrown(holding({ damage }), DOWN);
      expect(fighter(state, 1).tumbling).toBe(true);
      while (fighter(state, 1).hitlagFrames > 0) state = step(state, [NONE, NONE]);
      state = step(state, [NONE, NONE]);
      expect(fighter(state, 1)).toMatchObject({ action: 'knockdown', grounded: true });
      expect(fighter(state, 1).position.x - fighter(state, 0).position.x).toBeLessThan(2);
      // The thrower is free while it still lies there, to cover its getup options.
      while (fighter(state, 0).action === 'attack') state = step(state, [NONE, NONE]);
      expect(fighter(state, 1).action).toBe('knockdown');
    },
  );

  it('lets the thrown fighter tech the down throw with a press as it is slammed', () => {
    let state = thrown(holding({ damage: 30 }), DOWN);
    state = step(state, [NONE, inputOf({ shield: true })]);
    for (let i = 0; i < 20 && fighter(state, 1).action === 'hitstun'; i += 1) {
      state = step(state, [NONE, NONE]);
    }
    expect(fighter(state, 1).action).toBe('tech');
  });

  it('KOs with the back throw at high percent from the edge, not at low percent', () => {
    // Facing the stage from its right edge: the back throw sends P2 off the right side.
    const koes = (damage: number): boolean => {
      let state = thrown(holding({ damage, x: 8.5, facing: -1 }), BACK);
      for (let i = 0; i < 300; i += 1) {
        state = step(state, [NONE, NONE]);
        if (state.events.some((e) => e.type === 'ko' && e.slot === 1)) return true;
      }
      return false;
    };
    expect(koes(150)).toBe(true);
    expect(koes(40)).toBe(false);
  });

  describe('the combo throw: up throw at low percent', () => {
    it.each([CAPSULE, RIVET, VELA])('leaves a window to follow up on a $name', ({ id }) => {
      let state = thrown(holding({ target: id }), UP);
      while (fighter(state, 0).action === 'attack') state = step(state, [NONE, NONE]);
      // The thrower can act while the target is still in hitstun, close enough to reach.
      const target = fighter(state, 1);
      expect(target.action).toBe('hitstun');
      expect(target.hitstunFrames).toBeGreaterThanOrEqual(8);
      expect(target.position.y - fighter(state, 0).position.y).toBeLessThan(4);
    });

    it('sends a lighter fighter higher', () => {
      const height = (id: string) => launchOf(thrown(holding({ target: id }), UP)).y;
      expect(height(VELA.id)).toBeGreaterThan(height(CAPSULE.id));
    });
  });

  it('lets the thrown fighter DI the throw', () => {
    const plain = launchOf(thrown(holding({ damage: 60 }), UP));
    const drifted = launchOf(thrown(holding({ damage: 60 }), UP), inputOf({ x: 1 }));
    expect(drifted.x).toBeGreaterThan(plain.x);
  });

  it('is a hit: damage, a hit event and the stale queue', () => {
    const before = fighter(holding(), 1).damage;
    const state = thrown(holding(), FORWARD);
    expect(fighter(state, 1).damage).toBeGreaterThan(before);
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: 'hit', attacker: 0, target: 1 }),
    );
    expect(fighter(state, 0).staleMoves).toEqual(['forwardThrow']);
  });

  it('picks the throw by the way the stick was pushed, not a way it was held already', () => {
    // Forward held from before the grab, then up pushed: an up throw.
    const held = withFighter(holding(), 0, { previousInput: FORWARD });
    const state = step(held, [inputOf({ x: 1, y: 0.9 }), NONE]);
    expect(fighter(state, 0).moveId).toBe('upThrow');
    // Forward held, up nudged short of a push: no throw, as forward is no fresh push.
    const nudged = step(held, [inputOf({ x: 1, y: 0.4 }), NONE]);
    expect(fighter(nudged, 0).action).toBe('holding');
  });

  it('lets go when the thrower is hit before the throw frame', () => {
    let state = step(holding({ players: 3 }), [BACK, NONE, NONE]);
    state = withFighter(state, 2, { position: { x: -0.8, y: 0 }, facing: 1 });
    state = step(state, [NONE, NONE, inputOf({ attack: true })]);
    for (let i = 0; i < 20 && fighter(state, 0).action === 'attack'; i += 1) {
      state = step(state, [NONE, NONE, NONE]);
    }
    expect(fighter(state, 0)).toMatchObject({ action: 'hitstun', holding: null });
    expect(fighter(state, 1)).toMatchObject({ heldBy: null });
    expect(fighter(state, 1).action).not.toBe('grabbed');
  });

  it('whiffs harmlessly when someone else hits the held fighter mid-throw', () => {
    let state = step(holding({ players: 3 }), [BACK, NONE, NONE]);
    state = withFighter(state, 2, { position: { x: 1.7, y: 0 }, facing: -1 });
    state = step(state, [NONE, NONE, inputOf({ attack: true })]);
    for (let i = 0; i < 20 && fighter(state, 1).action !== 'hitstun'; i += 1) {
      state = step(state, [NONE, NONE, NONE]);
    }
    expect(fighter(state, 1).heldBy).toBeNull();
    expect(fighter(state, 0).holding).toBeNull();
    const hitsByThrower = (s: MatchState) =>
      s.events.filter((e) => e.type === 'hit' && e.attacker === 0).length;
    let thrown = 0;
    for (let i = 0; i < 30; i += 1) {
      state = step(state, [NONE, NONE, NONE]);
      thrown += hitsByThrower(state);
    }
    expect(thrown).toBe(0);
  });

  it('turns a back-thrown fighter to face the thrower it was swung behind', () => {
    const state = thrown(holding({ damage: 40 }), BACK);
    expect(fighter(state, 1).facing).toBe(1);
  });

  it('cannot be broken out of once it started', () => {
    const almostFree = withFighter(holding(), 1, { escapeFrames: 1 });
    const state = thrown(almostFree, UP, inputOf({ attack: true }));
    expect(fighter(state, 1).action).toBe('hitstun');
  });

  it('needs a fresh push: a stick held from before the grab does not throw', () => {
    let state = withFighter(holding(), 0, { previousInput: FORWARD });
    state = step(state, [FORWARD, NONE]);
    expect(fighter(state, 0).action).toBe('holding');
  });

  it('lets go on the throw frame of each throw, which lies inside the move', () => {
    for (const id of ['forwardThrow', 'backThrow', 'upThrow', 'downThrow']) {
      const move = findMove(id);
      expect(move.throw?.frame).toBeLessThan(move.totalFrames);
    }
  });
});
