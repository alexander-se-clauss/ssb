import { describe, expect, it } from 'vitest';
import { COUNTDOWN, TICK_RATE } from './config';
import { timeLeftFrames } from './rules';
import { createMatch, step } from './simulation';
import { BATTLEFIELD } from './stages';
import { CAPSULE } from './registry';
import { fighter, inputOf, run } from './test-helpers';
import type { FighterState, MatchRules, MatchState } from './types';

/** A match as the game starts it: with the READY countdown. */
const freshMatch = (rules: MatchRules = { mode: 'stock', stocks: 3, timeLimitSeconds: 60 }) =>
  createMatch({
    stageId: BATTLEFIELD.id,
    players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
    rules,
  });

const untilGo = (state: MatchState, inputs = [inputOf({}), inputOf({})]): MatchState =>
  run(state, COUNTDOWN.frames, inputs);

describe('READY / GO! countdown', () => {
  it('starts every match in the countdown and plays from GO on', () => {
    const start = freshMatch();
    expect(start.phase).toBe('countdown');
    expect(start.goFrame).toBe(COUNTDOWN.frames);
    expect(run(start, COUNTDOWN.frames - 1).phase).toBe('countdown');
    const go = untilGo(start);
    expect(go.phase).toBe('playing');
    expect(go.frame).toBe(COUNTDOWN.frames);
  });

  it('holds the fighters in place during the countdown, whatever the players press', () => {
    const pressing = [
      inputOf({ x: 1, jump: true, attack: true }),
      inputOf({ x: -1, special: true }),
    ];
    const pressed = untilGo(freshMatch(), pressing);
    const idle = untilGo(freshMatch());
    // They still settle on the stage and breathe; only the players' inputs are ignored. What
    // they hold is remembered (see below), everything else matches standing idle.
    const body = (f: FighterState) => ({ position: f.position, action: f.action, pose: f.pose });
    expect(pressed.fighters.map(body)).toEqual(idle.fighters.map(body));
    expect(fighter(pressed, 0).action).toBe('idle');
  });

  it('does not read a button or stick held through READY as a press at GO', () => {
    const holding = [inputOf({ x: 1, attack: true }), inputOf({ jump: true, special: true })];
    const afterGo = run(untilGo(freshMatch(), holding), 1, holding);
    expect(fighter(afterGo, 0).action).not.toBe('attack');
    expect(fighter(afterGo, 1).action).toBe('idle');
    expect(fighter(afterGo, 1).grounded).toBe(true);
  });

  it('lets the fighters move once GO is shown', () => {
    const go = untilGo(freshMatch());
    const moved = run(go, 10, [inputOf({ x: 1 }), inputOf({})]);
    expect(fighter(moved, 0).position.x).toBeGreaterThan(fighter(go, 0).position.x);
  });

  it('starts the match clock at GO', () => {
    const start = freshMatch({ mode: 'time', stocks: 3, timeLimitSeconds: 60 });
    const full = 60 * TICK_RATE;
    expect(timeLeftFrames(untilGo(start))).toBe(full);
    expect(timeLeftFrames(step(untilGo(start), []))).toBe(full - 1);
  });

  it('can be left out, e.g. for scenario tests', () => {
    const state = createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 60 },
      countdownFrames: 0,
    });
    expect(state.phase).toBe('playing');
    expect(state.goFrame).toBe(0);
  });

  it('rejects a countdown that is not a whole number of frames', () => {
    const config = {
      stageId: BATTLEFIELD.id,
      players: [{ characterId: CAPSULE.id }],
      rules: { mode: 'stock' as const, stocks: 3, timeLimitSeconds: 60 },
    };
    expect(() => createMatch({ ...config, countdownFrames: -1 })).toThrow();
    expect(() => createMatch({ ...config, countdownFrames: 1.5 })).toThrow();
  });
});
