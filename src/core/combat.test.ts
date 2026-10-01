import { describe, expect, it } from 'vitest';
import { JAB } from './config';
import { activeHitbox, hurtboxes, knockback, resolveCombat } from './combat';
import { HUMANOID, REST_POSE, plantedBoneSegments, type Pose } from './skeleton';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { FighterState, MatchState } from './types';

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
    expect(target.lastHitBy).toBe(0);
    expect(fighter(state, 0).damageDealt).toBe(JAB.damage);
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

describe('hurtboxes per body part', () => {
  /** P1 mid-jab at `attacker`, P2 facing it at `target` in `pose`. Both hold still for one check. */
  const swing = (
    attacker: { x: number; y: number },
    target: { x: number; y: number },
    pose: Pose,
  ) => {
    const state = faceOff();
    const p1: FighterState = {
      ...fighter(state, 0),
      position: attacker,
      action: 'jab',
      actionFrame: JAB.startupFrames,
    };
    const p2: FighterState = { ...fighter(state, 1), position: target, facing: -1, pose };
    expect(activeHitbox(p1)).not.toBeNull();
    return resolveCombat([p1, p2]).fighters[1]?.damage ?? 0;
  };

  // Knees and hips bent deep: the head drops well below standing height.
  const crouch: Pose = {
    ...REST_POSE,
    torso: 40,
    upperLegFront: 100,
    lowerLegFront: 120,
    upperLegBack: 120,
    lowerLegBack: 110,
  };
  // Upper body bent far forward, towards the attacker.
  const leanIn: Pose = { ...REST_POSE, torso: 60 };

  it('lets a crouch duck under a high attack that hits a standing fighter', () => {
    // A jab from above reaches down to standing head height, not to a crouched head.
    const above = { x: 0, y: 0.9 };
    expect(swing(above, { x: 0.8, y: 0 }, REST_POSE)).toBe(JAB.damage);
    expect(swing(above, { x: 0.8, y: 0 }, crouch)).toBe(0);
  });

  it('hits a fighter that leans into an attack it would miss standing up', () => {
    const ground = { x: 0, y: 0 };
    expect(swing(ground, { x: 1.6, y: 0 }, REST_POSE)).toBe(0);
    expect(swing(ground, { x: 1.6, y: 0 }, leanIn)).toBe(JAB.damage);
  });

  it('gives every bone a hurtbox that follows the drawn body', () => {
    const body = { ...fighter(faceOff(), 1), pose: crouch };
    const boxes = hurtboxes(body);
    expect(boxes.map((box) => box.bone)).toEqual(HUMANOID.bones.map((bone) => bone.id));
    const drawn = plantedBoneSegments(HUMANOID, crouch, body.position, body.facing);
    for (const box of boxes) {
      const def = HUMANOID.bones.find((bone) => bone.id === box.bone);
      expect(box.radius).toBe(def?.radius);
      const { start, end } = drawn[box.bone];
      if (def?.shape === 'ball') {
        // A ball sits in the middle of its bone.
        expect(box.start).toEqual(box.end);
        expect(box.start.x).toBeCloseTo((start.x + end.x) / 2, 9);
        expect(box.start.y).toBeCloseTo((start.y + end.y) / 2, 9);
      } else {
        expect(box.start).toEqual(start);
        expect(box.end).toEqual(end);
      }
    }
  });
});
