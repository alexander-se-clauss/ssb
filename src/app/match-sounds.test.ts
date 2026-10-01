import { describe, expect, it } from 'vitest';
import { FIGHTER, inputOf, type MatchState } from '../core';
import { newMatch, run, settled, withFighter } from '../core/test-helpers';
import { eventCue, stateCues } from './match-sounds';

const cuesOf = (before: MatchState, after: MatchState) =>
  stateCues(before, after).map((c) => c.cue);

describe('stateCues', () => {
  const ground = settled();

  it('stays quiet while fighters stand still', () => {
    expect(cuesOf(ground, run(ground, 10))).toEqual([]);
  });

  it('plays attack when a move starts, once', () => {
    const attacking = run(ground, 1, [inputOf({ attack: true })]);
    expect(cuesOf(ground, attacking)).toEqual(['attack']);
    expect(cuesOf(attacking, run(attacking, 3, [inputOf({ attack: true })]))).toEqual([]);
  });

  it('plays jump on a jump and land when the fighter is back on the ground', () => {
    // The jump sounds when the fighter leaves the ground, after the jump squat.
    const squatting = run(ground, FIGHTER.jumpSquatFrames, [inputOf({ jump: true })]);
    expect(cuesOf(ground, squatting)).toEqual([]);
    const jumping = run(squatting, 1);
    expect(cuesOf(squatting, jumping)).toEqual(['jump']);
    const landed = run(jumping, 120);
    expect(cuesOf(jumping, landed)).toEqual(['land']);
  });

  it('plays jump for a double jump', () => {
    const jumping = run(ground, 10, [inputOf({ jump: true })]);
    const released = run(jumping, 1);
    expect(cuesOf(released, run(released, 1, [inputOf({ jump: true })]))).toEqual(['jump']);
  });

  it('does not take walking off a ledge for a jump', () => {
    const before = ground;
    const walkedOff = withFighter(ground, 0, {
      grounded: false,
      jumpsRemaining: FIGHTER.totalJumps - 1,
      velocity: { x: 0.1, y: 0 },
    });
    expect(cuesOf(before, walkedOff)).toEqual([]);
  });

  it('plays jump for a jump stopped at once by a platform above', () => {
    const falling = withFighter(ground, 0, {
      grounded: false,
      jumpsRemaining: 1,
      velocity: { x: 0, y: -0.2 },
    });
    const bonked = withFighter(ground, 0, {
      grounded: false,
      jumpsRemaining: 0,
      velocity: { x: 0, y: 0 },
    });
    expect(cuesOf(falling, bonked)).toEqual(['jump']);
  });

  it('stays quiet for a fighter launched by a hit, until it hits the floor', () => {
    const launched = withFighter(ground, 0, {
      grounded: false,
      action: 'hitstun',
      jumpsRemaining: FIGHTER.totalJumps - 1,
      velocity: { x: 0.5, y: 0.5 },
    });
    expect(cuesOf(ground, launched)).toEqual([]);
    const downed = withFighter(launched, 0, { grounded: true });
    expect(cuesOf(launched, downed)).toEqual(['land']);
  });

  it('hears fighters landing when they drop in at the start', () => {
    const start = newMatch();
    expect(cuesOf(start, settled(start))).toEqual(['land', 'land']);
  });
});

describe('eventCue', () => {
  it('makes harder hits heavier, up to full strength', () => {
    const light = eventCue({ type: 'hit', attacker: 0, target: 1, damage: 3 });
    const heavy = eventCue({ type: 'hit', attacker: 0, target: 1, damage: 40 });
    expect(light.cue).toBe('hit');
    expect(light.strength).toBeLessThan(heavy.strength ?? 0);
    expect(heavy.strength).toBe(1);
  });

  it('plays ko and match-end for those events', () => {
    expect(eventCue({ type: 'ko', slot: 0, stocksLeft: 2 }).cue).toBe('ko');
    expect(eventCue({ type: 'match-end', winner: 1 }).cue).toBe('match-end');
  });
});
