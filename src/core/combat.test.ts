import { describe, expect, it } from 'vitest';
import { JAB } from './config';
import { knockback } from './combat';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { MatchState } from './types';

/** P1 on the main stage facing right, P2 standing right next to it. */
const faceOff = (p2Damage = 0): MatchState => {
  let state = settled();
  state = withFighter(state, 0, { position: { x: 0, y: 0 }, facing: 1, grounded: true });
  state = withFighter(state, 1, {
    position: { x: 0.8, y: 0 },
    facing: -1,
    grounded: true,
    damage: p2Damage,
  });
  return state;
};

const jab = [inputOf({ attack: true }), inputOf({})];

describe('combat', () => {
  it('a jab damages, launches and stuns the opponent', () => {
    const state = run(faceOff(), JAB.startupFrames + 1, jab);
    const target = fighter(state, 1);
    expect(target.damage).toBe(JAB.damage);
    expect(target.action).toBe('hitstun');
    expect(target.velocity.x).toBeGreaterThan(0);
    expect(target.velocity.y).toBeGreaterThan(0);
    expect(state.events).toContainEqual({
      type: 'hit',
      attacker: 0,
      target: 1,
      damage: JAB.damage,
    });
  });

  it('one swing hits a target only once', () => {
    const state = run(faceOff(), JAB.totalFrames - 1, jab);
    expect(fighter(state, 1).damage).toBe(JAB.damage);
  });

  it('does not hit an opponent out of range', () => {
    const far = withFighter(faceOff(), 1, { position: { x: 3, y: 0 } });
    const state = run(far, JAB.totalFrames - 1, jab);
    expect(fighter(state, 1).damage).toBe(0);
  });

  it('does not hit invulnerable opponents', () => {
    const shielded = withFighter(faceOff(), 1, { invulnerableFrames: 60 });
    const state = run(shielded, JAB.totalFrames - 1, jab);
    expect(fighter(state, 1).damage).toBe(0);
  });

  it('knockback grows with damage', () => {
    expect(knockback(JAB, 100, 1)).toBeGreaterThan(knockback(JAB, 10, 1));
    const low = run(faceOff(0), JAB.startupFrames + 1, jab);
    const high = run(faceOff(120), JAB.startupFrames + 1, jab);
    expect(fighter(high, 1).velocity.x).toBeGreaterThan(fighter(low, 1).velocity.x);
    expect(fighter(high, 1).hitstunFrames).toBeGreaterThan(fighter(low, 1).hitstunFrames);
  });
});
