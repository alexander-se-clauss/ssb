import { describe, expect, it } from 'vitest';
import { LEDGE } from './config';
import { hangPosition } from './ledge';
import { POSES } from './poses';
import { CAPSULE, STAGES } from './registry';
import { plantedBoneSegments } from './skeleton';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, newMatch, run, settled, withFighter } from './test-helpers';
import type { LedgeDef, MatchState } from './types';

const [LEFT, RIGHT] = BATTLEFIELD.ledges as [LedgeDef, LedgeDef];
const HANG = hangPosition(RIGHT, CAPSULE);

/** Fighter `slot` falling (or rising, with `vy` > 0) at `x, y`, no air jump used yet. */
const inAir = (state: MatchState, slot: number, x: number, y: number, vy = 0): MatchState =>
  withFighter(state, slot, {
    position: { x, y },
    velocity: { x: 0, y: vy },
    grounded: false,
    action: 'airborne',
    actionFrame: 0,
    jumpsRemaining: CAPSULE.stats.airJumps,
    invulnerableFrames: 0,
  });

/** One capsule on Battlefield, settled, so scenarios start in play. */
const solo = (): MatchState => settled(newMatch(1));

/** Fighter 0 hanging on the right ledge of Battlefield. */
const hanging = (): MatchState => {
  const state = run(inAir(solo(), 0, HANG.x, HANG.y + 0.1), 1);
  expect(fighter(state, 0).action).toBe('ledge');
  return state;
};

describe('ledges in stage data (#40)', () => {
  it('sit on the top corners of a solid platform, facing onto the stage', () => {
    for (const stage of STAGES) {
      expect(stage.ledges.length).toBeGreaterThan(0);
      for (const ledge of stage.ledges) {
        const corner = stage.platforms.find(
          (p) =>
            !p.passThrough &&
            p.bounds.top === ledge.position.y &&
            (ledge.facing === 1 ? p.bounds.left : p.bounds.right) === ledge.position.x,
        );
        expect(corner, `${stage.id} ledge at ${ledge.position.x}`).toBeDefined();
      }
    }
  });

  it('hang a fighter below the ledge with its hands on it, facing the stage', () => {
    for (const ledge of [LEFT, RIGHT]) {
      const at = hangPosition(ledge, CAPSULE);
      const body = plantedBoneSegments(CAPSULE.skeleton, POSES.ledge, at, ledge.facing);
      expect(body.lowerArmFront.end.x).toBeCloseTo(ledge.position.x, 1);
      expect(body.lowerArmFront.end.y).toBeCloseTo(ledge.position.y, 1);
      // Hanging off the side of the stage, not standing in it.
      expect(Math.sign(at.x - ledge.position.x)).toBe(-ledge.facing);
      expect(at.y).toBeLessThan(ledge.position.y - CAPSULE.stats.height / 2);
    }
  });
});

describe('ledge grab (#40)', () => {
  it('snaps a falling fighter near the ledge onto it', () => {
    const state = hanging();
    const hung = fighter(state, 0);
    expect(hung.position).toEqual(HANG);
    expect(hung.velocity).toEqual({ x: 0, y: 0 });
    expect(hung.facing).toBe(RIGHT.facing);
    expect(hung.ledge).toBe(BATTLEFIELD.ledges.indexOf(RIGHT));
    // Holds on while nothing is pressed.
    const later = fighter(run(state, 60), 0);
    expect(later.action).toBe('ledge');
    expect(later.position).toEqual(HANG);
  });

  it('reaches a ledge within the snap range, and not one beyond it', () => {
    const grabs = (dx: number, dy: number) =>
      fighter(run(inAir(solo(), 0, HANG.x + dx, HANG.y + dy), 1), 0).action === 'ledge';
    const { x, above, below } = LEDGE.snap;
    // Gravity moves the fighter 0.012 down this frame; the range is checked where it ends up.
    expect(grabs(x - 0.01, 0)).toBe(true);
    expect(grabs(-(x - 0.01), 0)).toBe(true);
    expect(grabs(0, above)).toBe(true);
    expect(grabs(0, -below + 0.02)).toBe(true);
    expect(grabs(x + 0.01, 0)).toBe(false);
    expect(grabs(0, above + 0.05)).toBe(false);
    expect(grabs(0, -below - 0.01)).toBe(false);
  });

  it('is not grabbed while rising, or while holding down', () => {
    const rising = run(inAir(solo(), 0, HANG.x, HANG.y, 0.1), 1);
    expect(fighter(rising, 0).action).toBe('airborne');
    const down = run(inAir(solo(), 0, HANG.x, HANG.y + 0.1), 1, [inputOf({ y: -1 })]);
    expect(fighter(down, 0).action).toBe('airborne');
  });

  it('catches a fighter that walks slowly off the edge of the stage', () => {
    let state = withFighter(solo(), 0, { position: { x: 6, y: 0 }, facing: 1 });
    let caught = false;
    for (let i = 0; i < 120 && !caught; i += 1) {
      // A slow walk to the edge, then the stick let go.
      state = run(state, 1, [inputOf({ x: fighter(state, 0).grounded ? 0.3 : 0 })]);
      caught = fighter(state, 0).action === 'ledge';
    }
    expect(caught).toBe(true);
    expect(fighter(state, 0).facing).toBe(-1);
  });

  it('makes the fighter briefly invulnerable', () => {
    const state = hanging();
    expect(fighter(state, 0).invulnerableFrames).toBe(LEDGE.invulnerableFrames);
    expect(fighter(run(state, LEDGE.invulnerableFrames - 1), 0).invulnerableFrames).toBe(1);
    expect(fighter(run(state, LEDGE.invulnerableFrames), 0).invulnerableFrames).toBe(0);
    // A longer invulnerability, such as after a respawn, is kept.
    const fresh = withFighter(inAir(solo(), 0, HANG.x, HANG.y + 0.1), 0, {
      invulnerableFrames: 100,
    });
    expect(fighter(run(fresh, 1), 0).invulnerableFrames).toBe(99);
  });

  it('cannot be hit while invulnerable, and is knocked off the ledge after', () => {
    /** P2 drops past the hanging P1 with a neutral air, facing it; P1's state after. */
    const nairPast = (state: MatchState) => {
      const p2 = withFighter(inAir(state, 1, HANG.x + 0.6, HANG.y + 1), 1, { facing: -1 });
      const pressed = run(p2, 1, [inputOf({}), inputOf({ attack: true })]);
      return run(pressed, 20, [inputOf({}), inputOf({})]);
    };
    const two = settled(newMatch(2));
    const grabbed = run(inAir(two, 0, HANG.x, HANG.y + 0.1), 1);
    expect(fighter(grabbed, 0).action).toBe('ledge');
    const early = nairPast(grabbed);
    expect(fighter(early, 0).action).toBe('ledge');
    expect(fighter(early, 0).damage).toBe(0);
    const late = nairPast(run(grabbed, LEDGE.invulnerableFrames));
    // Hit and launched (its short hitstun may be over by now): off the ledge, which is free again.
    expect(fighter(late, 0).damage).toBeGreaterThan(0);
    expect(fighter(late, 0).action).not.toBe('ledge');
    expect(fighter(late, 0).ledge).toBeNull();
  });

  it('gives the air jumps and the air dodge back', () => {
    const tired = withFighter(inAir(solo(), 0, HANG.x, HANG.y + 0.1), 0, {
      jumpsRemaining: 0,
      airDodgeUsed: true,
    });
    const hung = fighter(run(tired, 1), 0);
    expect(hung.jumpsRemaining).toBe(CAPSULE.stats.airJumps);
    expect(hung.airDodgeUsed).toBe(false);
  });

  it('holds one fighter per ledge', () => {
    const two = settled(newMatch(2));
    // P1 holds the ledge; P2 falls past it and does not take it.
    let state = run(inAir(two, 0, HANG.x, HANG.y + 0.1), 1);
    expect(fighter(state, 0).action).toBe('ledge');
    state = run(inAir(state, 1, HANG.x, HANG.y + 0.1), 1);
    expect(fighter(state, 1).action).toBe('airborne');
    expect(fighter(state, 0).action).toBe('ledge');
    // Both reach a free ledge on the same frame: the lower slot gets it.
    const left = hangPosition(LEFT, CAPSULE);
    const both = run(inAir(inAir(two, 0, left.x, left.y + 0.1), 1, left.x, left.y + 0.1), 1);
    expect(fighter(both, 0).action).toBe('ledge');
    expect(fighter(both, 1).action).toBe('airborne');
  });

  it('drops a fighter that holds on too long, and does not catch it again at once', () => {
    const state = hanging();
    expect(fighter(run(state, LEDGE.hangFrames - 1), 0).action).toBe('ledge');
    const dropped = run(state, LEDGE.hangFrames);
    expect(fighter(dropped, 0).action).toBe('airborne');
    expect(fighter(dropped, 0).ledge).toBeNull();
    // It falls away instead of grabbing the same ledge again.
    const falling = run(dropped, LEDGE.regrabFrames);
    expect(fighter(falling, 0).action).toBe('airborne');
    expect(fighter(falling, 0).position.y).toBeLessThan(HANG.y - LEDGE.snap.below);
  });

  it('frees the ledge for the next fighter once the holder lets go', () => {
    const two = settled(newMatch(2));
    const dropped = run(run(inAir(two, 0, HANG.x, HANG.y + 0.1), 1), LEDGE.hangFrames);
    expect(fighter(dropped, 0).action).toBe('airborne');
    const next = run(inAir(dropped, 1, HANG.x, HANG.y + 0.1), 1);
    expect(fighter(next, 1).action).toBe('ledge');
  });
});
