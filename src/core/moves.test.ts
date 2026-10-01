import { describe, expect, it } from 'vitest';
import { activeHitboxes } from './combat';
import { MOVES, findMove } from './move-data';
import { moveTiming, validateMove, type MoveDef } from './moves';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';

const JAB = findMove('jab');

describe('move data', () => {
  it('keeps the M0 jab numbers', () => {
    expect(moveTiming(JAB)).toEqual({ startupFrames: 3, activeFrames: 3, totalFrames: 18 });
    expect(JAB.hitboxes).toEqual([
      {
        anchor: { feet: { x: 0.75, y: 0.9 } },
        radius: 0.45,
        from: 3,
        to: 6,
        priority: 0,
        damage: 6,
        angle: 40,
        baseKnockback: 0.12,
        knockbackGrowth: 0.0045,
      },
    ]);
  });

  it('accepts every registered move and is plain data', () => {
    for (const move of Object.values(MOVES)) expect(() => validateMove(move)).not.toThrow();
    expect(JSON.parse(JSON.stringify(MOVES))).toEqual(MOVES);
  });

  it('refuses a move whose hitbox windows do not fit its frames', () => {
    const broken = (patch: Partial<MoveDef['hitboxes'][number]>): MoveDef => ({
      ...JAB,
      hitboxes: JAB.hitboxes.map((hitbox) => ({ ...hitbox, ...patch })),
    });
    expect(() => validateMove(broken({ from: 6, to: 3 }))).toThrow(/jab/);
    expect(() => validateMove(broken({ to: 40 }))).toThrow(/jab/);
    expect(() => validateMove(broken({ from: -1 }))).toThrow(/jab/);
    expect(() => validateMove(broken({ radius: 0 }))).toThrow(/jab/);
    expect(() => validateMove({ ...JAB, totalFrames: 0 })).toThrow(/jab/);
  });

  it('refuses an unknown move id', () => {
    expect(() => findMove('teleport-punch')).toThrow(/teleport-punch/);
  });
});

describe('move runner', () => {
  const attack = [inputOf({ attack: true }), inputOf({})];

  it('plays the jab when attack is pressed, then returns to standing', () => {
    let state = run(settled(), 1, attack);
    expect(fighter(state, 0).action).toBe('attack');
    expect(fighter(state, 0).moveId).toBe('jab');
    state = run(state, JAB.totalFrames);
    expect(fighter(state, 0).action).toBe('idle');
    expect(fighter(state, 0).moveId).toBeNull();
  });

  it('turns the hitbox on only during its active frames, at the fighter, mirrored by facing', () => {
    const timing = moveTiming(JAB);
    const at = (actionFrame: number, facing: 1 | -1) =>
      activeHitboxes(
        fighter(
          withFighter(settled(), 0, {
            action: 'attack',
            moveId: 'jab',
            actionFrame,
            facing,
            position: { x: 1, y: 2 },
          }),
          0,
        ),
      );
    expect(at(timing.startupFrames - 1, 1)).toEqual([]);
    expect(at(timing.startupFrames, 1).map((h) => h.center)).toEqual([{ x: 1.75, y: 2.9 }]);
    expect(at(timing.startupFrames, -1).map((h) => h.center)).toEqual([{ x: 0.25, y: 2.9 }]);
    expect(at(timing.startupFrames + timing.activeFrames, 1)).toEqual([]);
  });

  it('forgets the move when a fighter is knocked out of the match mid-attack', () => {
    const lastStock = withFighter(settled(), 0, {
      action: 'attack',
      moveId: 'jab',
      stocks: 1,
      position: { x: 0, y: -100 },
    });
    const out = fighter(run(lastStock, 1), 0);
    expect(out.action).toBe('eliminated');
    expect(out.moveId).toBeNull();
  });
});
