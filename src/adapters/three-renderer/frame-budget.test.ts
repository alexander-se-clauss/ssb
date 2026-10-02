import { describe, expect, it } from 'vitest';
import { FrameBudget } from './frame-budget';

const moving = { animated: true, changed: false };
const still = { animated: false, changed: false };

/** Runs frames 16 ms apart; every drawing the budget measures took `cost` ms. */
const run = (budget: FrameBudget, frames: number, cost: number): boolean[] => {
  const drawn: boolean[] = [];
  for (let i = 0; i < frames; i++) {
    const now = i * 16;
    const draw = budget.shouldDraw(now, moving);
    if (draw) budget.drew(now, budget.measuring ? cost : undefined);
    drawn.push(draw);
  }
  return drawn;
};

describe('FrameBudget', () => {
  it('draws every frame when drawing is cheap', () => {
    expect(run(new FrameBudget(), 300, 0.5).every(Boolean)).toBe(true);
  });

  it('draws rarely when drawing is slow, leaving most of the time to the page', () => {
    // 400 ms a drawing at a 10% share: a new picture every 3.6 s, so 2 in 8 s.
    const drawn = run(new FrameBudget(), 500, 400);
    expect(drawn.filter(Boolean).length).toBeLessThanOrEqual(4);
    expect(drawn.slice(1).some(Boolean)).toBe(true);
  });

  it('does not count the first drawing, which also compiles the shaders', () => {
    const budget = new FrameBudget();
    budget.drew(0, budget.measuring ? 1000 : undefined);
    expect(budget.shouldDraw(16, moving)).toBe(true);
  });

  it('keeps measuring now and then, so a faster machine state is noticed', () => {
    const budget = new FrameBudget();
    let measured = 0;
    for (let i = 0; i < 300; i++) {
      if (budget.measuring) measured++;
      budget.drew(i * 16, 0.5);
    }
    expect(measured).toBeGreaterThan(3);
    expect(measured).toBeLessThan(20);
  });

  it('draws every change, even when drawing is slow', () => {
    const budget = new FrameBudget();
    budget.drew(0);
    budget.drew(16, 400);
    expect(budget.shouldDraw(32, moving)).toBe(false);
    expect(budget.shouldDraw(32, { animated: true, changed: true })).toBe(true);
  });

  it('keeps a still picture still', () => {
    const budget = new FrameBudget();
    budget.drew(0);
    expect(budget.shouldDraw(10_000, still)).toBe(false);
  });
});
