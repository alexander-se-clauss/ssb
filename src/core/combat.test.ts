import { describe, expect, it } from 'vitest';
import { JAB } from './config';
import { activeHitbox, hurtboxes, knockback, resolveCombat } from './combat';
import { POSES } from './poses';
import { HUMANOID, type Pose } from './skeleton';
import { step } from './simulation';
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

  // From the fighting stance, knees and hips bent deep: the head drops well below its height.
  const crouch: Pose = {
    ...POSES.idle,
    torso: 45,
    upperLegFront: 100,
    lowerLegFront: 120,
    upperLegBack: 130,
    lowerLegBack: 110,
  };
  // From the fighting stance, the upper body bent far forward, towards the attacker.
  const leanIn: Pose = { ...POSES.idle, torso: 70 };

  it('lets a crouch duck under a high attack that hits the fighting stance', () => {
    // A jab from above reaches down to the head of a standing fighter, not a crouched one.
    const above = { x: 0, y: 0.7 };
    expect(swing(above, { x: 1, y: 0 }, POSES.idle)).toBe(JAB.damage);
    expect(swing(above, { x: 1, y: 0 }, crouch)).toBe(0);
  });

  it('hits a fighter that leans into an attack the fighting stance stays clear of', () => {
    const ground = { x: 0, y: 0 };
    expect(swing(ground, { x: 1.87, y: 0 }, POSES.idle)).toBe(0);
    expect(swing(ground, { x: 1.87, y: 0 }, leanIn)).toBe(JAB.damage);
  });

  it('judges a hit in a match by the pose the fighter has on that frame', () => {
    // P1's jab turns active on the next step; P2 stands just out of reach of the stance.
    const strike = (pose: Pose): number => {
      let state = withFighter(faceOff(), 0, { action: 'jab', actionFrame: JAB.startupFrames - 1 });
      state = withFighter(state, 1, { position: { x: 1.87, y: 0 }, pose });
      return fighter(step(state, []), 1).damage;
    };
    expect(strike(POSES.idle)).toBe(0);
    expect(strike(leanIn)).toBe(JAB.damage);
  });

  it('gives every bone a hurtbox as thick as the part the view draws', () => {
    const boxes = hurtboxes({ ...fighter(faceOff(), 1), pose: crouch });
    expect(boxes.map((box) => box.bone)).toEqual(HUMANOID.bones.map((bone) => bone.id));
    expect(boxes.map((box) => box.radius)).toEqual(HUMANOID.bones.map((bone) => bone.radius));
    // A ball, like the head, has both ends in one place.
    const head = boxes.find((box) => box.bone === 'head');
    expect(head?.start).toEqual(head?.end);
    // A capsule's round ends stay inside its joints, the way the view draws it.
    const shin = boxes.find((box) => box.bone === 'lowerLegFront');
    const def = HUMANOID.bones.find((bone) => bone.id === 'lowerLegFront');
    const core = shin ? Math.hypot(shin.end.x - shin.start.x, shin.end.y - shin.start.y) : 0;
    expect(core + 2 * (def?.radius ?? 0)).toBeCloseTo(def?.length ?? 0, 9);
  });
});
