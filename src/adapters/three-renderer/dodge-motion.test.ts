import { describe, expect, it } from 'vitest';
import { DODGE, LEDGE, type FighterAction } from '../../core';
import { DODGE_DEPTH, LEDGE_DEPTH, dodgeMotion, lerpAngle } from './dodge-motion';
import { MAIN_BLOCK_DEPTH } from './scenery/common';

const TURN = 2 * Math.PI;
const at = (action: FighterAction, actionFrame: number, facing: 1 | -1 = 1) =>
  dodgeMotion({ action, actionFrame, facing });
/** The same angle in -π .. π. */
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

describe('dodge motion', () => {
  it('leaves fighters alone unless they dodge', () => {
    for (const action of ['idle', 'run', 'airborne', 'attack', 'hitstun'] as const) {
      expect(at(action, 10)).toEqual({ depth: 0, spin: 0, yaw: 0 });
    }
  });

  it.each([
    ['sidestepIn', -1],
    ['sidestepOut', 1],
  ] as const)('%s steps out of the stage plane and back, as in Melee', (action, side) => {
    const back = DODGE.sidestep.invulnerableTo - 1;
    expect(at(action, 0).depth).toBeCloseTo(0, 9);
    expect(at(action, Math.round(back / 2)).depth).toBeCloseTo(side * DODGE_DEPTH, 1);
    for (let frame = 1; frame < back; frame += 1) {
      expect(Math.sign(at(action, frame).depth)).toBe(side);
    }
    // Back on the plane by the last invulnerable frame: the view interpolates from it into the
    // first frame the fighter can be hit.
    for (let frame = back; frame <= DODGE.sidestep.totalFrames; frame += 1) {
      expect(at(action, frame)).toEqual({ depth: 0, spin: 0, yaw: 0 });
    }
  });

  it('rolls stay on the stage plane and turn the body once over the way they travel', () => {
    const { moveFrom, moveTo, totalFrames } = DODGE.roll;
    const middle = Math.round((moveFrom + moveTo) / 2);
    // Facing right: a forward roll goes right (clockwise, a negative angle), a back roll left.
    expect(at('forwardRoll', middle, 1).spin).toBeLessThan(0);
    expect(at('backRoll', middle, 1).spin).toBeGreaterThan(0);
    expect(at('backRoll', middle, -1).spin).toBeLessThan(0);
    for (let frame = 0; frame <= totalFrames; frame += 1) {
      expect(at('forwardRoll', frame).depth).toBe(0);
    }
    expect(Math.abs(at('forwardRoll', moveFrom).spin)).toBeCloseTo(0, 9);
    expect(Math.abs(at('forwardRoll', moveTo).spin)).toBeCloseTo(TURN, 9);
  });

  it('spins the air dodge once round the vertical axis, done before it can be hit', () => {
    const back = DODGE.air.invulnerableTo - 1;
    expect(at('airDodge', 0).yaw).toBeCloseTo(0, 9);
    expect(at('airDodge', back / 2).yaw).toBeCloseTo(Math.PI, 9);
    expect(wrap(at('airDodge', back).yaw)).toBeCloseTo(0, 9);
    expect(at('airDodge', 10).depth).toBe(0);
  });
});

describe('ledge motion', () => {
  it('draws a fighter hanging from a ledge in front of the stage block, not hidden beside it', () => {
    expect(at('ledge', 0)).toEqual({ depth: LEDGE_DEPTH, spin: 0, yaw: 0 });
    expect(LEDGE_DEPTH).toBeGreaterThan(MAIN_BLOCK_DEPTH / 2);
  });

  it('brings a climbing fighter back onto the stage plane, and rolls a ledge roll once over', () => {
    for (const action of ['ledgeStand', 'ledgeRoll', 'ledgeAttack'] as const) {
      expect(at(action, 0).depth).toBeCloseTo(LEDGE_DEPTH, 9);
      expect(at(action, 20).depth).toBeCloseTo(0, 9);
    }
    const { climbFrames, rollTo } = LEDGE.getup.roll;
    expect(at('ledgeRoll', climbFrames, -1).spin).toBeCloseTo(0, 9);
    expect(wrap(at('ledgeRoll', rollTo, -1).spin)).toBeCloseTo(0, 9);
    expect(at('ledgeRoll', rollTo, -1).spin).toBeCloseTo(TURN, 9);
  });
});

describe('lerpAngle', () => {
  it('turns the short way round', () => {
    expect(wrap(lerpAngle(-TURN, 0, 0.5))).toBeCloseTo(0, 9);
    expect(Math.abs(wrap(lerpAngle(3, -3, 0.5)))).toBeCloseTo(Math.PI, 9);
    expect(lerpAngle(0, 1, 0.25)).toBeCloseTo(0.25, 9);
  });
});
