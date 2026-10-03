import { describe, expect, it } from 'vitest';
import { LEDGE } from './config';
import { climbPosition, hangPosition, type LedgeClimb } from './ledge';
import { findMove } from './move-data';
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

describe('getting up from a ledge (#41)', () => {
  const { stand, roll, attack, jump } = LEDGE.getup;
  /** On the right ledge, the stage is to the left: towards it is stick left. */
  const TOWARDS = -1;
  /** Where the feet end up `distance` onto the stage from the right ledge. */
  const onStage = (distance: number) => RIGHT.position.x - distance;

  /** Hanging, past the wait and on the last invulnerable frame of the grab. */
  const ready = (): MatchState => run(hanging(), LEDGE.invulnerableFrames - 1);
  /** Picks an option with `input` held for one frame; the option starts on that frame. */
  const pick = (input: Parameters<typeof inputOf>[0]): MatchState =>
    run(ready(), 1, [inputOf(input)]);

  it('waits a moment after the grab, and takes only a fresh input', () => {
    // Pushed during the wait: too early, and still held after it, so not fresh.
    const early = run(hanging(), LEDGE.waitFrames - 1, [inputOf({ x: TOWARDS, jump: true })]);
    expect(fighter(early, 0).action).toBe('ledge');
    const held = run(early, 10, [inputOf({ x: TOWARDS, jump: true })]);
    expect(fighter(held, 0).action).toBe('ledge');
    // Let go and pushed again: now it counts.
    const again = run(run(held, 1), 1, [inputOf({ x: TOWARDS })]);
    expect(fighter(again, 0).action).toBe('ledgeStand');
  });

  it('stands up onto the stage with the stick towards it, or up', () => {
    for (const input of [{ x: TOWARDS }, { y: 1 }]) {
      const started = pick(input);
      expect(fighter(started, 0).action).toBe('ledgeStand');
      expect(fighter(started, 0).invulnerableFrames).toBe(stand.invulnerableFrames);
      expect(fighter(run(started, stand.totalFrames - 1), 0).action).toBe('ledgeStand');
      const up = fighter(run(started, stand.totalFrames), 0);
      expect(up.action).toBe('idle');
      expect(up.grounded).toBe(true);
      expect(up.position.x).toBeCloseTo(onStage(stand.distance), 6);
      expect(up.position.y).toBe(RIGHT.position.y);
      expect(up.ledge).toBeNull();
    }
  });

  /** Two fighters: P1 climbing from the right ledge with `input`, P2 standing on the stage. */
  const climbingPast = (input: Parameters<typeof inputOf>[0]): MatchState => {
    const two = settled(newMatch(2));
    const grabbed = run(inAir(two, 0, HANG.x, HANG.y + 0.1), LEDGE.invulnerableFrames);
    return run(grabbed, 1, [inputOf(input), inputOf({})]);
  };

  /**
   * P2 kicks a forward tilt at P1 from just beside where P1 will be, active on frames
   * `frame`..`frame + 3` of P1's climb. With `exposed`, P1's invulnerability is taken away first.
   * Returns P1 after the kick.
   */
  const kickedOn = (started: MatchState, action: LedgeClimb, frame: number, exposed = false) => {
    const before = run(started, frame - 5);
    const at = climbPosition(action, frame, RIGHT, CAPSULE);
    let state = withFighter(before, 1, {
      position: { x: at.x - 0.9, y: 0 },
      velocity: { x: 0, y: 0 },
      grounded: true,
      facing: 1,
      action: 'attack',
      moveId: 'forwardTilt',
      actionFrame: 0,
      hitTargets: [],
    });
    if (exposed) state = withFighter(state, 0, { invulnerableFrames: 0 });
    return fighter(run(state, 6), 0);
  };

  it.each([
    ['ledgeStand', { x: TOWARDS }, stand.invulnerableFrames],
    ['ledgeRoll', { shield: true }, roll.invulnerableFrames],
  ] as const)(
    '%s cannot be hit on its invulnerable frames, but can after',
    (action, input, inv) => {
      const started = climbingPast(input);
      expect(fighter(started, 0).action).toBe(action);
      // The kick lands on the last four invulnerable frames: no hit, though it would hit otherwise.
      expect(kickedOn(started, action, inv - 4).damage).toBe(0);
      expect(kickedOn(started, action, inv - 4, true).damage).toBeGreaterThan(0);
      // Right after: hit, launched, and no longer on its way up from the ledge.
      const hit = kickedOn(started, action, inv);
      expect(hit.damage).toBeGreaterThan(0);
      expect(hit.action).toBe('hitstun');
      expect(hit.ledge).toBeNull();
    },
  );

  it('keeps the rest of the grab invulnerability for an option picked early', () => {
    const early = run(run(hanging(), LEDGE.waitFrames - 1), 1, [inputOf({ jump: true })]);
    expect(fighter(early, 0).action).toBe('airborne');
    expect(fighter(early, 0).invulnerableFrames).toBe(LEDGE.invulnerableFrames - LEDGE.waitFrames);
    expect(LEDGE.invulnerableFrames - LEDGE.waitFrames).toBeGreaterThan(jump.invulnerableFrames);
  });

  it('rolls further onto the stage with the dodge button', () => {
    const started = pick({ shield: true });
    expect(fighter(started, 0).action).toBe('ledgeRoll');
    expect(fighter(started, 0).invulnerableFrames).toBe(roll.invulnerableFrames);
    expect(fighter(run(started, roll.totalFrames - 1), 0).action).toBe('ledgeRoll');
    const up = fighter(run(started, roll.totalFrames), 0);
    expect(up.action).toBe('idle');
    expect(up.grounded).toBe(true);
    expect(up.position.x).toBeCloseTo(onStage(roll.distance), 6);
    expect(roll.distance).toBeGreaterThan(stand.distance);
  });

  it('climbs up and attacks with the attack button, hitting a fighter by the ledge', () => {
    const two = settled(newMatch(2));
    const grabbed = run(inAir(two, 0, HANG.x, HANG.y + 0.1), 1);
    const target = withFighter(run(grabbed, LEDGE.invulnerableFrames - 1), 1, {
      position: { x: onStage(stand.distance + 0.8), y: 0 },
      facing: 1,
    });
    const started = run(target, 1, [inputOf({ attack: true }), inputOf({})]);
    expect(fighter(started, 0).action).toBe('ledgeAttack');
    expect(fighter(started, 0).invulnerableFrames).toBe(attack.invulnerableFrames);
    const swinging = run(started, attack.climbFrames);
    expect(fighter(swinging, 0).action).toBe('attack');
    expect(fighter(swinging, 0).moveId).toBe(CAPSULE.moves.ledgeAttack);
    expect(fighter(swinging, 0).grounded).toBe(true);
    expect(fighter(swinging, 0).position.x).toBeCloseTo(onStage(attack.distance), 6);
    const moveFrames = findMove(CAPSULE.moves.ledgeAttack ?? '').totalFrames;
    // The hit freezes both fighters for its hitlag on top of the move.
    const done = run(started, attack.climbFrames + moveFrames + 10);
    expect(fighter(done, 1).damage).toBeGreaterThan(0);
    expect(fighter(done, 0).action).toBe('idle');
  });

  it('jumps up past the ledge with the jump button, keeping the air jumps', () => {
    const started = pick({ jump: true });
    const jumper = fighter(started, 0);
    expect(jumper.action).toBe('airborne');
    expect(jumper.velocity.y).toBeGreaterThan(0);
    expect(jumper.invulnerableFrames).toBe(jump.invulnerableFrames);
    expect(jumper.jumpsRemaining).toBe(CAPSULE.stats.airJumps);
    expect(jumper.ledge).toBeNull();
    // High enough to come down on the stage with the stick towards it.
    let state = started;
    let highest = -Infinity;
    for (let i = 0; i < 90; i += 1) {
      state = run(state, 1, [inputOf({ x: TOWARDS })]);
      highest = Math.max(highest, fighter(state, 0).position.y);
    }
    expect(highest).toBeGreaterThan(RIGHT.position.y + 1);
    expect(fighter(state, 0).grounded).toBe(true);
  });

  it('lets go with the stick down or away from the stage, and falls past the ledge', () => {
    for (const input of [{ y: -1 }, { x: -TOWARDS }]) {
      const started = pick(input);
      expect(fighter(started, 0).action).toBe('airborne');
      expect(fighter(started, 0).ledge).toBeNull();
      expect(fighter(started, 0).jumpsRemaining).toBe(CAPSULE.stats.airJumps);
      const later = fighter(run(started, LEDGE.regrabFrames), 0);
      expect(later.action).toBe('airborne');
      expect(later.position.y).toBeLessThan(HANG.y - LEDGE.snap.below);
    }
  });

  it('frees the ledge for a lower slot on the very frame a higher slot starts to climb', () => {
    const two = settled(newMatch(2));
    const hangingP2 = run(inAir(two, 1, HANG.x, HANG.y + 0.1), LEDGE.invulnerableFrames);
    expect(fighter(hangingP2, 1).action).toBe('ledge');
    // P1 reaches the ledge on the same frame P2 climbs off it.
    const both = run(inAir(hangingP2, 0, HANG.x, HANG.y + 0.1), 1, [
      inputOf({}),
      inputOf({ x: TOWARDS }),
    ]);
    expect(fighter(both, 1).action).toBe('ledgeStand');
    expect(fighter(both, 0).action).toBe('ledge');
  });

  it('frees the ledge as soon as the fighter starts to climb', () => {
    const two = settled(newMatch(2));
    const climbing = run(run(inAir(two, 0, HANG.x, HANG.y + 0.1), LEDGE.waitFrames), 1, [
      inputOf({ x: TOWARDS }),
    ]);
    expect(fighter(climbing, 0).action).toBe('ledgeStand');
    const next = run(inAir(climbing, 1, HANG.x, HANG.y + 0.1), 1);
    expect(fighter(next, 1).action).toBe('ledge');
  });
});
