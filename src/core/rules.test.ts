import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TICK_RATE } from './config';
import { score, timeLeftFrames } from './rules';
import { step } from './simulation';
import { fighter, newMatch, run, settled, withFighter } from './test-helpers';
import type { MatchState } from './types';

const offStage = { position: { x: 20, y: 0 }, action: 'airborne' as const };

/** A two-player time match of `seconds`, with everyone standing on the stage. */
const timeMatch = (seconds = 60): MatchState =>
  settled(newMatch(2, { mode: 'time', stocks: 3, timeLimitSeconds: seconds }));

const toTheEnd = (state: MatchState): MatchState => run(state, timeLeftFrames(state) ?? 0);

describe('stock rule', () => {
  it('has no clock', () => {
    expect(timeLeftFrames(settled())).toBeNull();
  });
});

describe('time rule', () => {
  it('counts down from the time limit', () => {
    const state = newMatch(2, { mode: 'time', stocks: 3, timeLimitSeconds: 60 });
    expect(timeLeftFrames(state)).toBe(60 * TICK_RATE);
    expect(timeLeftFrames(step(state, []))).toBe(60 * TICK_RATE - 1);
  });

  it('keeps playing until time runs out', () => {
    const state = timeMatch();
    const almost = run(state, (timeLeftFrames(state) ?? 0) - 1);
    expect(almost.phase).toBe('playing');
    expect(timeLeftFrames(almost)).toBe(1);
  });

  it('lets the leader win when time runs out', () => {
    let state = timeMatch();
    state = withFighter(state, 0, { kos: 1, falls: 2 });
    state = withFighter(state, 1, { kos: 2, falls: 1 });
    const end = toTheEnd(state);
    expect(end.phase).toBe('finished');
    expect(end.winner).toBe(1);
    expect(end.events).toContainEqual({ type: 'match-end', winner: 1 });
  });

  it('is a draw when the leaders are tied', () => {
    let state = timeMatch();
    state = withFighter(state, 0, { kos: 2, falls: 1 });
    state = withFighter(state, 1, { kos: 1, falls: 0 });
    const end = toTheEnd(state);
    expect(end.phase).toBe('finished');
    expect(end.winner).toBeNull();
  });

  it('respawns a knocked-out fighter however often, counting a fall', () => {
    const state = step(withFighter(timeMatch(), 0, { ...offStage, stocks: 1 }), []);
    expect(state.events).toContainEqual({ type: 'ko', slot: 0, stocksLeft: null });
    const p1 = fighter(state, 0);
    expect(p1.action).not.toBe('eliminated');
    expect(p1.falls).toBe(1);
    expect(state.phase).toBe('playing');
  });
});

describe('rule validation', () => {
  it('rejects rules outside the options limits', () => {
    expect(() => newMatch(2, { ...DEFAULT_RULES, stocks: 0 })).toThrow(/stocks/i);
    expect(() => newMatch(2, { ...DEFAULT_RULES, stocks: 2.5 })).toThrow(/stocks/i);
    expect(() => newMatch(2, { ...DEFAULT_RULES, timeLimitSeconds: 0 })).toThrow(/time limit/i);
  });
});

describe('KO credit', () => {
  it('goes to whoever hit the fighter last', () => {
    const state = step(withFighter(timeMatch(), 1, { ...offStage, lastHitBy: 0 }), []);
    expect(fighter(state, 0).kos).toBe(1);
    expect(fighter(state, 1).falls).toBe(1);
    expect(score(fighter(state, 0))).toBe(1);
    expect(score(fighter(state, 1))).toBe(-1);
  });

  it('goes to nobody for a self-destruct, and is cleared on respawn', () => {
    const state = step(withFighter(timeMatch(), 1, offStage), []);
    expect(fighter(state, 0).kos).toBe(0);
    expect(fighter(state, 1).falls).toBe(1);
    expect(fighter(state, 1).lastHitBy).toBeNull();
  });

  it('is counted in stock matches too', () => {
    const state = step(withFighter(settled(), 1, { ...offStage, lastHitBy: 0 }), []);
    expect(fighter(state, 0).kos).toBe(1);
    expect(fighter(state, 1).stocks).toBe(2);
  });
});
