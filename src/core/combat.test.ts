import { describe, expect, it } from 'vitest';
import { attackInput } from './attack-input';
import {
  activeHitboxes,
  hitlagFrames,
  hurtboxes,
  knockback,
  resolveCombat,
  strikingHitbox,
  type Hitbox,
} from './combat';
import { findMove } from './move-data';
import { moveTiming } from './moves';
import { movePose, POSES } from './poses';
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

// The jab's timing and its one hit, read from its move definition (ADR 0006).
const jabHit = findMove('jab').hitboxes[0];
if (!jabHit) throw new Error('The jab has a hitbox');
const JAB = { ...moveTiming(findMove('jab')), ...jabHit };

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
    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: 'hit',
        attacker: 0,
        target: 1,
        damage: JAB.damage,
      }),
    );
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

describe('knockback and hitlag per move', () => {
  /** The frame the jab connects, and the state right after. */
  const connected = () => run(faceOff(), JAB.startupFrames + 1, jab);

  it('launches at the angle of the hitbox that struck', () => {
    const { velocity } = fighter(connected(), 1);
    expect((Math.atan2(velocity.y, velocity.x) * 180) / Math.PI).toBeCloseTo(JAB.angle, 9);
  });

  it('makes hitlag longer for harder hits, scaled per hitbox', () => {
    expect(hitlagFrames({ damage: 6 })).toBe(5);
    expect(hitlagFrames({ damage: 4 })).toBe(4);
    expect(hitlagFrames({ damage: 30 })).toBeGreaterThan(hitlagFrames({ damage: 6 }));
    expect(hitlagFrames({ damage: 6, hitlagScale: 2 })).toBe(2 * 5);
  });

  it('freezes attacker and target for the hitlag, then lets the launch go', () => {
    const hit = connected();
    const frames = hitlagFrames(JAB);
    expect(fighter(hit, 0).hitlagFrames).toBe(frames);
    expect(fighter(hit, 1).hitlagFrames).toBe(frames);
    let state = hit;
    for (let i = 0; i < frames; i += 1) {
      state = run(state, 1);
      for (const slot of [0, 1]) {
        const before = fighter(hit, slot);
        const now = fighter(state, slot);
        // Nothing moves: not the body, not the move, not the pose; the launch is only held.
        expect(now.position).toEqual(before.position);
        expect(now.velocity).toEqual(before.velocity);
        expect(now.actionFrame).toBe(before.actionFrame);
        expect(now.hitstunFrames).toBe(before.hitstunFrames);
        expect(now.pose).toEqual(before.pose);
      }
    }
    expect(fighter(state, 1).hitlagFrames).toBe(0);
    const after = run(state, 1);
    expect(fighter(after, 1).position.x).toBeGreaterThan(fighter(hit, 1).position.x);
    expect(fighter(after, 0).actionFrame).toBe(fighter(hit, 0).actionFrame + 1);
  });

  it('keeps tracking the stick through hitlag, so a stick held through it stays a tilt', () => {
    const frozen = withFighter(faceOff(), 0, { hitlagFrames: 6 });
    // The stick goes from the centre to the rim during the freeze and stays there.
    const state = run(frozen, 7, [inputOf({ x: 1 })]);
    expect(fighter(state, 0).hitlagFrames).toBe(0);
    expect(attackInput(fighter(state, 0).stick, 1).strength).toBe('tilt');
  });

  it('ends hitlag when a fighter is knocked out of the match', () => {
    const lastStock = withFighter(settled(), 0, {
      hitlagFrames: 4,
      stocks: 1,
      position: { x: 0, y: -100 },
    });
    expect(fighter(run(lastStock, 1), 0).hitlagFrames).toBe(0);
  });
});

describe('which hitbox strikes', () => {
  const target = fighter(faceOff(), 1);
  const chest = { x: target.position.x, y: target.position.y + 1 };
  /** A hitbox of the jab, moved onto the target's chest unless told otherwise. */
  const box = (patch: Partial<Hitbox['attack']>, center = chest): Hitbox => ({
    center,
    radius: 0.2,
    attack: { ...JAB, ...patch },
  });

  it('picks the highest priority when several hitboxes touch the target', () => {
    const weak = box({ priority: 0, damage: 4 });
    const strong = box({ priority: 2, damage: 9 });
    expect(strikingHitbox([weak, strong], target, [])).toBe(strong);
    expect(strikingHitbox([strong, weak], target, [])).toBe(strong);
  });

  it('picks the first in the list when priorities are equal', () => {
    const first = box({ damage: 4 });
    const second = box({ damage: 9 });
    expect(strikingHitbox([first, second], target, [])).toBe(first);
  });

  it('ignores hitboxes that do not touch the body, even with a higher priority', () => {
    const touching = box({ priority: 0 });
    const missing = box({ priority: 5 }, { x: chest.x + 5, y: chest.y });
    expect(strikingHitbox([missing, touching], target, [])).toBe(touching);
    expect(strikingHitbox([missing], target, [])).toBeUndefined();
  });

  it('hits a target once per group: a group that already hit it is skipped', () => {
    const firstHit = box({ group: 0, priority: 3 });
    const secondHit = box({ group: 1, priority: 0 });
    expect(strikingHitbox([firstHit, secondHit], target, [0])).toBe(secondHit);
    expect(strikingHitbox([firstHit, secondHit], target, [0, 1])).toBeUndefined();
    // Without a group, a hitbox is in group 0.
    expect(strikingHitbox([box({})], target, [0])).toBeUndefined();
  });

  it('records each hit by target and group, and only that group stops hitting that target', () => {
    const swinging = (hitTargets: FighterState['hitTargets']) =>
      withFighter(faceOff(), 0, {
        action: 'attack',
        moveId: 'jab',
        actionFrame: JAB.startupFrames - 1,
        pose: movePose(findMove('jab'), JAB.startupFrames - 1),
        hitTargets,
      });
    const fresh = step(swinging([]), []);
    expect(fighter(fresh, 0).hitTargets).toEqual([{ slot: 1, group: 0 }]);
    // Group 0 already hit this target: no second hit.
    expect(fighter(step(swinging([{ slot: 1, group: 0 }]), []), 1).damage).toBe(0);
    // Another group, or group 0 on another target, does not protect it.
    expect(fighter(step(swinging([{ slot: 1, group: 1 }]), []), 1).damage).toBe(JAB.damage);
    expect(fighter(step(swinging([{ slot: 2, group: 0 }]), []), 1).damage).toBe(JAB.damage);
  });

  it('lands the jab with its fist, not its arm, when both touch', () => {
    const before = run(faceOff(), JAB.startupFrames, jab);
    const after = run(before, 1, jab);
    const [fist, arm] = activeHitboxes(fighter(after, 0));
    if (!fist || !arm) throw new Error('Both jab hitboxes are on');
    expect(strikingHitbox([arm], fighter(before, 1), [])).toBe(arm);
    expect(strikingHitbox([fist], fighter(before, 1), [])).toBe(fist);
    expect(fighter(after, 1).damage).toBe(fist.attack.damage);
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
      action: 'attack',
      moveId: 'jab',
      actionFrame: JAB.startupFrames,
      pose: movePose(findMove('jab'), JAB.startupFrames),
    };
    const p2: FighterState = { ...fighter(state, 1), position: target, facing: -1, pose };
    expect(activeHitboxes(p1)).not.toEqual([]);
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
  // Where the stance stays just clear of the jab's fist; leaning in, even partly, gets hit.
  const edgeOfReach = { x: 1.72, y: 0 };

  it('lets a crouch duck under a high attack that hits the fighting stance', () => {
    // A jab from above reaches down to the head of a standing fighter, not a crouched one.
    const above = { x: 0, y: 0.4 };
    expect(swing(above, { x: 1, y: 0 }, POSES.idle)).toBe(JAB.damage);
    expect(swing(above, { x: 1, y: 0 }, crouch)).toBe(0);
  });

  it('hits a fighter that leans into an attack the fighting stance stays clear of', () => {
    const ground = { x: 0, y: 0 };
    expect(swing(ground, edgeOfReach, POSES.idle)).toBe(0);
    expect(swing(ground, edgeOfReach, leanIn)).toBe(JAB.damage);
  });

  it('judges a hit in a match by the pose the fighter has on that frame', () => {
    // P1's jab turns active on the next step; P2 stands just out of reach of the stance.
    const strike = (pose: Pose): number => {
      let state = withFighter(faceOff(), 0, {
        action: 'attack',
        moveId: 'jab',
        actionFrame: JAB.startupFrames - 1,
        pose: movePose(findMove('jab'), JAB.startupFrames - 1),
      });
      state = withFighter(state, 1, { position: edgeOfReach, pose });
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
