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
      expect(at(action, Math.round(invulnerableTo / 2))).toBeCloseTo(-DODGE_DEPTH, 1);
      for (let frame = 1; frame < invulnerableTo; frame += 1) {
        expect(at(action, frame)).toBeLessThan(0);
      }
      // Open to a punish, the fighter is back on the stage plane where it can be hit.
      for (let frame = invulnerableTo; frame <= totalFrames; frame += 1) {
        expect(at(action, frame)).toBeCloseTo(0, 9);
      }
    },
  );
});
