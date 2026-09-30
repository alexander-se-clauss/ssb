import { describe, expect, it } from 'vitest';
import { FIGHTER } from './config';
import { step } from './simulation';
import { fighter, inputOf, newMatch, run, settled, withFighter } from './test-helpers';

describe('fighter movement', () => {
  it('falls from the spawn point and lands on a platform', () => {
    const state = settled();
    const p1 = fighter(state, 0);
    expect(p1.grounded).toBe(true);
    expect(p1.action).toBe('idle');
    expect(p1.velocity.y).toBe(0);
  });

  it('runs in the held direction and faces it', () => {
    const start = settled();
    const moved = run(start, 8, [inputOf({ x: -1 })]);
    expect(fighter(moved, 0).position.x).toBeLessThan(fighter(start, 0).position.x);
    expect(fighter(moved, 0).facing).toBe(-1);
    expect(fighter(moved, 0).action).toBe('run');
  });

  it('allows one ground jump and one air jump, but not a third', () => {
    let state = settled();
    const press = [inputOf({ jump: true })];
    const release = [inputOf({})];

    state = step(state, press);
    expect(fighter(state, 0).velocity.y).toBeCloseTo(FIGHTER.jumpVelocity - FIGHTER.gravity);
    state = run(state, 5, release);
    state = step(state, press);
    expect(fighter(state, 0).jumpsRemaining).toBe(0);
    state = run(state, 5, release);

    const beforeThird = fighter(state, 0).velocity.y;
    state = step(state, press);
    expect(fighter(state, 0).velocity.y).toBeLessThan(beforeThird);
  });

  it('holding jump does not repeat the jump', () => {
    const state = run(settled(), 30, [inputOf({ jump: true })]);
    expect(fighter(state, 0).jumpsRemaining).toBe(FIGHTER.totalJumps - 1);
  });

  it('drops through a pass-through platform when holding down', () => {
    // Slot 0 spawns above the left pass-through platform at y = 2.2.
    const onPlatform = settled();
    expect(fighter(onPlatform, 0).position.y).toBeCloseTo(2.2);
    const dropped = run(onPlatform, 30, [inputOf({ y: -1 })]);
    expect(fighter(dropped, 0).position.y).toBeCloseTo(0);
  });

  it('walks off the edge of the main stage and falls', () => {
    const state = withFighter(settled(), 0, {
      position: { x: 6.9, y: 0 },
      grounded: true,
      action: 'idle',
    });
    const after = run(state, 20, [inputOf({ x: 1 })]);
    expect(fighter(after, 0).grounded).toBe(false);
    expect(fighter(after, 0).position.y).toBeLessThan(0);
  });

  it('cannot walk into the side of the main stage from below the ledge', () => {
    const state = withFighter(newMatch(), 0, {
      position: { x: 8, y: -1 },
      velocity: { x: -0.1, y: 0 },
      action: 'airborne',
    });
    const after = run(state, 5, [inputOf({ x: -1 })]);
    expect(fighter(after, 0).position.x).toBeGreaterThanOrEqual(7 + FIGHTER.width / 2 - 1e-9);
  });
});
