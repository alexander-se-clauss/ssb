import { describe, expect, it } from 'vitest';
import { STALE } from './config';
import { findMove } from './move-data';
import { resolveObjectHits } from './objects';
import { CAPSULE, RIVET, VELA } from './registry';
import { createMatch, step } from './simulation';
import { damageScale, queueBefore, queueMove } from './stale';
import { FINAL_DESTINATION } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MoveId } from './moves';
import type { GameEvent, MatchState, SpawnedObject } from './types';

const NONE = inputOf({});
const JAB = inputOf({ attack: true });

/** The scale after `count` uses of a move, all of them the most recent hits. */
const afterUses = (count: number): number =>
  damageScale(
    Array.from({ length: count }, (): MoveId => 'jab'),
    'jab',
  );

describe('the stale move queue (#157)', () => {
  it(`gives a fresh move a ${Math.round((STALE.freshBonus - 1) * 100)}% bonus`, () => {
    expect(damageScale([], 'jab')).toBe(STALE.freshBonus);
    expect(damageScale(['forwardTilt', 'upTilt'], 'jab')).toBe(STALE.freshBonus);
  });

  it.each([
    // [copies in the queue, all of them the most recent] => damage scale
    [1, 0.91],
    [2, 0.83],
    [3, 0.76],
    [4, 0.7],
    [5, 0.65],
    [6, 0.61],
    [7, 0.58],
    [8, 0.56],
    [9, 0.55],
  ] as const)('scales a move %i times in the queue to %f of its damage', (count, scale) => {
    expect(afterUses(count)).toBeCloseTo(scale, 9);
  });

  it('weakens a move more for a recent use than for an old one', () => {
    const others: MoveId[] = Array.from({ length: 8 }, () => 'forwardTilt');
    expect(damageScale(['jab', ...others], 'jab')).toBeLessThan(
      damageScale([...others, 'jab'], 'jab'),
    );
  });

  it("leaves a use's own entry out of the scale for its later hits, wherever it sits", () => {
    expect(queueBefore(['jab', 'upTilt'], 'jab', true)).toEqual(['jab', 'upTilt']);
    expect(queueBefore(['jab', 'upTilt'], 'jab', false)).toEqual(['upTilt']);
    // A shot of the same fighter hit in between and went in front of it.
    expect(queueBefore(['pulseShot', 'springJack', 'jab'], 'springJack', false)).toEqual([
      'pulseShot',
      'jab',
    ]);
  });

  it(`remembers the last ${STALE.queueLength} hits, newest first`, () => {
    let queue: readonly MoveId[] = [];
    for (let i = 0; i < 12; i += 1) queue = queueMove(queue, i === 0 ? 'jab' : 'forwardTilt');
    expect(queue).toHaveLength(STALE.queueLength);
    expect(queue).not.toContain('jab');
    expect(queueMove(queue, 'upTilt')[0]).toBe('upTilt');
  });
});

/** Two fighters facing each other at the centre of Final Destination, P2 in front of P1. */
const faceOff = (attacker = CAPSULE.id, gap = 0.9): MatchState => {
  const state = run(
    createMatch({
      stageId: FINAL_DESTINATION.id,
      players: [{ characterId: attacker }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );
  return placed(state, gap);
};

/** P1 back at the centre facing right, P2 standing `gap` in front, as at the start. */
const placed = (state: MatchState, gap = 0.9): MatchState =>
  withFighter(
    withFighter(state, 0, {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      knockback: { x: 0, y: 0 },
      facing: 1,
      grounded: true,
      action: 'idle',
      moveId: null,
    }),
    1,
    {
      position: { x: gap, y: 0 },
      velocity: { x: 0, y: 0 },
      knockback: { x: 0, y: 0 },
      facing: -1,
      grounded: true,
      action: 'idle',
      hitstunFrames: 0,
      hitlagFrames: 0,
      tumbling: false,
    },
  );

const hits = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === 'hit' && e.attacker === 0 ? [e] : []));

/** P1 presses `input` once and plays the move out; the damage of each of its hits. */
const playMove = (state: MatchState, input = JAB): { state: MatchState; damage: number[] } => {
  let now = step(state, [input, NONE]);
  const damage = hits(now.events).map((e) => e.damage);
  for (let i = 0; i < 90 && fighter(now, 0).action !== 'idle'; i += 1) {
    now = step(now, [NONE, NONE]);
    damage.push(...hits(now.events).map((e) => e.damage));
  }
  return { state: now, damage };
};

const JAB_DAMAGE = findMove('jab').hitboxes[0]?.damage ?? 0;

describe('stale moves in a match (#157)', () => {
  it('deals more with a fresh jab, then less with each repeat', () => {
    let state = faceOff();
    const dealt: number[] = [];
    for (let use = 0; use < 4; use += 1) {
      const played = playMove(placed(state));
      expect(played.damage).toHaveLength(1);
      dealt.push(played.damage[0] ?? 0);
      state = played.state;
    }
    expect(dealt[0]).toBeCloseTo(JAB_DAMAGE * STALE.freshBonus, 9);
    expect(dealt[1]).toBeCloseTo(JAB_DAMAGE * afterUses(1), 9);
    expect(dealt[3]).toBeCloseTo(JAB_DAMAGE * afterUses(3), 9);
    expect(fighter(state, 0).staleMoves).toEqual(['jab', 'jab', 'jab', 'jab']);
  });

  it('launches less far with a stale move, as its damage drives the knockback', () => {
    const SMASH = inputOf({ x: 1, attack: true });
    const fresh = placed(faceOff());
    const stale = withFighter(fresh, 0, {
      staleMoves: Array.from({ length: 9 }, (): MoveId => 'forwardSmash'),
    });
    const launchOf = (state: MatchState) => {
      let now = step(withFighter(state, 1, { damage: 80 }), [SMASH, NONE]);
      for (let i = 0; i < 60 && hits(now.events).length === 0; i += 1) {
        now = step(now, [NONE, NONE]);
      }
      return Math.hypot(fighter(now, 1).knockback.x, fighter(now, 1).knockback.y);
    };
    expect(launchOf(stale)).toBeLessThan(launchOf(fresh));
  });

  it("counts a multi-hit move once per use, so it does not weaken its own hits: Rivet's spring jack", () => {
    const UP_SPECIAL = inputOf({ y: 1, special: true });
    const { state, damage } = playMove(faceOff(RIVET.id, 0.7), UP_SPECIAL);
    const planned = findMove('springJack').hitboxes.map((h) => h.damage);
    expect(damage.length).toBeGreaterThan(1);
    damage.forEach((dealt) => {
      expect(planned.map((d) => d * STALE.freshBonus)).toContainEqual(dealt);
    });
    expect(fighter(state, 0).staleMoves).toEqual(['springJack']);
  });

  it('queues a shot when it hits, crediting its owner', () => {
    const state = placed(faceOff());
    const shot: SpawnedObject = {
      id: 0,
      owner: 0,
      moveId: 'pulseShot',
      position: { ...fighter(state, 1).position, y: 1 },
      velocity: { x: 0.3, y: 0 },
      launchVelocity: { x: 0.3, y: 0 },
      facing: 1,
      age: 20,
      lifetime: 40,
      radius: 0.3,
      hit: { damage: 6, angle: 30, baseKnockback: 10, knockbackGrowth: 97 },
      behavior: { kind: 'straight' },
    };
    const first = resolveObjectHits([shot], state.fighters);
    expect(first.events[0]).toMatchObject({ type: 'hit', damage: 6 * STALE.freshBonus });
    expect(first.fighters[0]?.staleMoves).toEqual(['pulseShot']);
    const second = resolveObjectHits([shot], first.fighters);
    expect(second.events[0]).toMatchObject({ damage: 6 * afterUses(1) });
  });

  it('does not stale a move that a counter stopped', () => {
    const vela = withFighter(placed(faceOff()), 1, {
      characterId: VELA.id,
      action: 'attack',
      moveId: 'riposte',
      actionFrame: (findMove('riposte').counter?.from ?? 0) + 1,
    });
    let state = step(vela, [JAB, NONE]);
    for (let i = 0; i < 30 && !state.events.some((e) => e.type === 'hit'); i += 1) {
      state = step(state, [NONE, NONE]);
    }
    expect(state.events).toContainEqual(expect.objectContaining({ guard: 'countered' }));
    expect(fighter(state, 0).staleMoves).toEqual([]);
  });

  it('empties the queue when its fighter loses a stock', () => {
    const full = Array.from({ length: 9 }, (): MoveId => 'jab');
    let state = withFighter(faceOff(), 0, {
      staleMoves: full,
      position: { x: 0, y: FINAL_DESTINATION.blastZone.bottom - 1 },
      grounded: false,
      action: 'airborne',
    });
    state = step(state, [NONE, NONE]);
    expect(fighter(state, 0).stocks).toBe(2);
    expect(fighter(state, 0).staleMoves).toEqual([]);
  });
});
