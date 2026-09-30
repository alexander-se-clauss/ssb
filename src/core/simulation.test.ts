import { describe, expect, it } from 'vitest';
import { FIGHTER } from './config';
import { step } from './simulation';
import { fighter, inputOf, newMatch, run, settled, withFighter } from './test-helpers';
import type { PlayerInput } from './types';

const offStage = { position: { x: 20, y: 0 }, action: 'airborne' as const, damage: 80 };

describe('match simulation', () => {
  it('loses a stock and respawns invulnerable when leaving the blast zone', () => {
    const state = step(withFighter(settled(), 0, offStage), []);
    const p1 = fighter(state, 0);
    expect(p1.stocks).toBe(2);
    expect(p1.damage).toBe(0);
    expect(p1.invulnerableFrames).toBe(FIGHTER.respawnInvulnerabilityFrames);
    expect(state.events).toContainEqual({ type: 'ko', slot: 0, stocksLeft: 2 });
    expect(state.phase).toBe('playing');
  });

  it('ends the match when only one fighter has stocks left', () => {
    const lastStock = withFighter(settled(), 0, { ...offStage, stocks: 1 });
    const state = step(lastStock, []);
    expect(fighter(state, 0).action).toBe('eliminated');
    expect(state.phase).toBe('finished');
    expect(state.winner).toBe(1);
    expect(state.events).toContainEqual({ type: 'match-end', winner: 1 });
  });

  it('does not advance a finished match', () => {
    const finished = step(withFighter(settled(), 0, { ...offStage, stocks: 1 }), []);
    expect(step(finished, []).frame).toBe(finished.frame);
  });

  it('is deterministic: the same inputs produce the same state', () => {
    // A scripted input sequence standing in for a recorded replay.
    const script = (frame: number): PlayerInput[] => [
      inputOf({ x: Math.sin(frame / 10), jump: frame % 45 === 0, attack: frame % 30 === 0 }),
      inputOf({ x: -Math.cos(frame / 7), jump: frame % 50 === 5, attack: frame % 25 === 0 }),
    ];
    const play = () => {
      let state = newMatch();
      for (let frame = 0; frame < 1200; frame += 1) state = step(state, script(frame));
      return state;
    };
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });

  it('never mutates the previous state', () => {
    const before = settled();
    const snapshot = JSON.stringify(before);
    run(before, 30, [inputOf({ x: 1, attack: true })]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
