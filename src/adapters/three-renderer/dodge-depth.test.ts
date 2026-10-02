import { describe, expect, it } from 'vitest';
import { DODGE, type FighterAction } from '../../core';
import { DODGE_DEPTH, dodgeDepth } from './dodge-depth';

const at = (action: FighterAction, actionFrame: number) => dodgeDepth({ action, actionFrame });

describe('dodge depth', () => {
  it('keeps fighters on the stage plane unless they dodge', () => {
    for (const action of ['idle', 'run', 'airborne', 'attack', 'hitstun'] as const) {
      expect(at(action, 10)).toBe(0);
    }
  });

  it.each([
    ['spotDodge', DODGE.spot],
    ['forwardRoll', DODGE.roll],
    ['backRoll', DODGE.roll],
    ['airDodge', DODGE.air],
  ] as const)(
    'steps %s into the background and back by the end of its invulnerability, as in Melee',
    (action, { invulnerableTo, totalFrames }) => {
      expect(at(action, 0)).toBeCloseTo(0, 9);
      const back = invulnerableTo - 1;
      expect(at(action, Math.round(back / 2))).toBeCloseTo(-DODGE_DEPTH, 1);
      for (let frame = 1; frame < back; frame += 1) expect(at(action, frame)).toBeLessThan(0);
      // Back on the stage plane by the last invulnerable frame: the view interpolates from it to
      // the first frame the fighter can be hit, and draws that in between on the plane too.
      for (let frame = back; frame <= totalFrames; frame += 1) {
        expect(at(action, frame)).toBeCloseTo(0, 9);
      }
    },
  );
});
