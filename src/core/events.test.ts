import { describe, expect, it } from 'vitest';
import { STALE } from './config';
import { activeHitboxes, knockback, launchSpeed } from './combat';
import { findMove } from './move-data';
import { moveTiming } from './moves';
import { CAPSULE } from './registry';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { GameEvent, MatchState } from './types';

type HitEvent = Extract<GameEvent, { type: 'hit' }>;
type KoEvent = Extract<GameEvent, { type: 'ko' }>;

/** P1 on the main stage facing right, P2 right in front of it with `damage` percent. */
const faceOff = (damage = 0): MatchState => {
  let state = withFighter(settled(), 0, { position: { x: 0, y: 0 }, facing: 1, grounded: true });
  state = withFighter(state, 1, {
    position: { x: 0.8, y: 0 },
    facing: -1,
    grounded: true,
    damage,
  });
  return state;
};

const JAB = findMove('jab');
const JAB_HIT = JAB.hitboxes[0];
if (!JAB_HIT) throw new Error('The jab has a hitbox');

/** Plays P1's jab until it hits, returning the hit event and the state just before it. */
const jabHit = (damage = 0): { event: HitEvent; before: MatchState } => {
  let state = run(faceOff(damage), 1, [inputOf({ attack: true })]);
  for (let i = 0; i < moveTiming(JAB).totalFrames; i += 1) {
    const next = run(state, 1);
    const event = next.events.find((e): e is HitEvent => e.type === 'hit');
    if (event) return { event, before: state };
    state = next;
  }
  throw new Error('The jab never hit');
};

describe('match events for the view (#48)', () => {
  it("reports a hit's own damage, not the target's total", () => {
    const { event } = jabHit(50);
    expect(event.damage).toBe(JAB_HIT.damage * STALE.freshBonus);
  });

  it('reports where the hit landed: on the hitbox that struck', () => {
    const { event, before } = jabHit();
    // The fighter one frame on, as combat sees it, carries the hitbox that struck.
    const attacker = fighter(run(before, 1), 0);
    const hitbox = activeHitboxes({ ...attacker, hitlagFrames: 0 })[0];
    expect(hitbox).toBeDefined();
    expect(event.position.x).toBeCloseTo(hitbox?.center.x ?? Number.NaN);
    expect(event.position.y).toBeCloseTo(hitbox?.center.y ?? Number.NaN);
  });

  it('reports how hard the hit launched, which grows with the damage', () => {
    const light = jabHit(0).event;
    const heavy = jabHit(120).event;
    expect(light.launch).toBeCloseTo(
      launchSpeed(knockback(JAB_HIT, JAB_HIT.damage, CAPSULE.stats.weight)),
    );
    expect(heavy.launch).toBeGreaterThan(light.launch * 2);
  });

  it('reports where a fighter left the blast zone, on its edge', () => {
    const state = withFighter(settled(), 1, {
      position: { x: BATTLEFIELD.blastZone.right - 0.1, y: 30 },
      velocity: { x: 0.5, y: 0 },
      grounded: false,
    });
    const next = run(state, 1);
    const ko = next.events.find((e): e is KoEvent => e.type === 'ko');
    expect(ko).toBeDefined();
    expect(ko?.slot).toBe(1);
    // Past the right edge and above the top: the corner it left through.
    expect(ko?.position).toEqual({ x: BATTLEFIELD.blastZone.right, y: BATTLEFIELD.blastZone.top });
  });

  it('puts a KO off the side at the height it left', () => {
    const state = withFighter(settled(), 1, {
      position: { x: BATTLEFIELD.blastZone.left + 0.1, y: 3 },
      velocity: { x: -0.5, y: 0 },
      grounded: false,
    });
    const ko = run(state, 1).events.find((e): e is KoEvent => e.type === 'ko');
    expect(ko?.position.x).toBe(BATTLEFIELD.blastZone.left);
    expect(ko?.position.y).toBeGreaterThan(2);
    expect(ko?.position.y).toBeLessThan(3.1);
    expect(fighter(run(state, 1), 1).falls).toBe(1);
  });
});
