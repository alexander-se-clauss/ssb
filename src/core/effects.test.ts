import { describe, expect, it } from 'vitest';
import { activeEffects, activeHitboxes } from './combat';
import { findMove } from './move-data';
import { validateMove, type MoveDef } from './moves';
import { POSES } from './pose-data';
import { CAPSULE, RIVET } from './registry';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { FighterState, MatchState } from './types';

/** Rivet settled at the centre of Battlefield, facing right, with a capsule far away. */
const rivet = (): MatchState => {
  const state = run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: RIVET.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );
  return withFighter(withFighter(state, 0, { position: { x: 0, y: 0 }, facing: 1 }), 1, {
    position: { x: -6, y: 0 },
  });
};

/** Rivet's haymaker, played up to its frame `frame`. */
const haymakerAt = (frame: number): FighterState => {
  const started = run(rivet(), 1, [inputOf({ special: true })]);
  const at = fighter(run(started, frame), 0);
  expect(at.moveId).toBe('haymaker');
  expect(at.actionFrame).toBe(frame);
  return at;
};

describe('move effects (#47)', () => {
  it("burns on Rivet's fist through the haymaker's wind-up and punch", () => {
    const haymaker = findMove('haymaker');
    const fire = haymaker.effects?.find((key) => key.effect === 'fire');
    expect(fire).toBeDefined();
    // Lit before the punch lands and still burning while it hits.
    const punch = Math.min(...haymaker.hitboxes.map((hitbox) => hitbox.from));
    expect(fire?.from).toBeLessThan(punch);
    expect(fire?.to).toBeGreaterThan(punch);
  });

  it('is on only on the frames the move lists, where its anchor is', () => {
    const fire = findMove('haymaker').effects?.[0];
    if (!fire) throw new Error('no effect');
    expect(activeEffects(haymakerAt(fire.from - 1))).toEqual([]);
    const burning = haymakerAt(18);
    const effects = activeEffects(burning);
    expect(effects).toHaveLength(1);
    // On the same fist the punch's hitbox sits on.
    const fist = activeHitboxes(burning)[0];
    expect(effects[0]?.effect).toBe('fire');
    expect(effects[0]?.position.x).toBeCloseTo(fist?.center.x ?? Number.NaN);
    expect(effects[0]?.position.y).toBeCloseTo(fist?.center.y ?? Number.NaN);
    expect(activeEffects(haymakerAt(fire.to))).toEqual([]);
  });

  it('is nothing outside a move', () => {
    expect(activeEffects(fighter(rivet(), 0))).toEqual([]);
  });

  it('keeps move effects out of the match state, so they cannot change the game', () => {
    const burning = run(run(rivet(), 1, [inputOf({ special: true })]), 18);
    expect(activeEffects(fighter(burning, 0))).not.toEqual([]);
    expect(JSON.stringify(burning)).not.toContain('fire');
  });
});

describe('effect data (#47)', () => {
  const base: MoveDef = {
    kind: 'attack',
    id: 'glowing',
    totalFrames: 20,
    hitboxes: [],
    poses: [{ frame: 0, pose: POSES.idle }],
    cancels: [],
  };
  const withEffect = (patch: object): MoveDef => ({
    ...base,
    effects: [
      { effect: 'fire', anchor: { bone: 'lowerArmFront', at: 1 }, from: 2, to: 10, ...patch },
    ],
  });

  it('accepts an effect key on a bone or at the feet', () => {
    expect(() => validateMove(withEffect({}))).not.toThrow();
    expect(() => validateMove(withEffect({ anchor: { feet: { x: 0.5, y: 0 } } }))).not.toThrow();
  });

  it.each([
    ['with no name', { effect: '' }],
    ['with an empty window', { from: 5, to: 5 }],
    ['after the move', { to: 21 }],
    ['on an unknown bone', { anchor: { bone: 'tail', at: 0.5 } }],
    ['off its bone', { anchor: { bone: 'torso', at: 1.5 } }],
  ])('refuses an effect %s', (_, patch) => {
    expect(() => validateMove(withEffect(patch))).toThrow(/effect 0/);
  });

  it('lets a spawn name the effect its object trails', () => {
    const move: MoveDef = {
      ...base,
      spawns: [
        {
          frame: 5,
          offset: { x: 0.5, y: 1 },
          velocity: { x: 0.2, y: 0 },
          lifetime: 30,
          radius: 0.3,
          hit: { damage: 4, angle: 30, baseKnockback: 3, knockbackGrowth: 87 },
          effect: 'fire',
        },
      ],
    };
    expect(() => validateMove(move)).not.toThrow();
    const blank = {
      ...move,
      spawns: (move.spawns ?? []).map((spawn) => ({ ...spawn, effect: '' })),
    };
    expect(() => validateMove(blank)).toThrow(/spawn 0/);
  });
});
