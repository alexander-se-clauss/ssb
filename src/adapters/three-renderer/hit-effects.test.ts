import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../core';
import { burstFor } from './hit-effects';
import { hasEffect } from './particles';

const hit = (launch: number): GameEvent => ({
  type: 'hit',
  attacker: 0,
  target: 1,
  damage: 5,
  position: { x: 1, y: 2 },
  launch,
});

describe('hit and KO effects (#48)', () => {
  it('sprays sparks where a hit landed', () => {
    const burst = burstFor(hit(0.3));
    expect(burst?.effect).toBe('spark');
    expect(burst).toMatchObject({ x: 1, y: 2 });
    expect(hasEffect(burst?.effect ?? '')).toBe(true);
  });

  it('scales the sparks with the strength of the hit, up to a cap', () => {
    const jab = burstFor(hit(0.1));
    const smash = burstFor(hit(1.2));
    const huge = burstFor(hit(5));
    expect(smash?.count).toBeGreaterThan((jab?.count ?? 0) * 2);
    expect(smash?.power).toBeGreaterThan(jab?.power ?? 0);
    // A KO smash is already as big as it gets.
    expect(huge).toEqual(smash);
  });

  it('bursts where a fighter left the blast zone', () => {
    const burst = burstFor({ type: 'ko', slot: 1, stocksLeft: 2, position: { x: 22, y: 3 } });
    expect(burst).toMatchObject({ effect: 'ko', x: 22, y: 3 });
    expect(burst?.count).toBeGreaterThan(burstFor(hit(5))?.count ?? 0);
    expect(hasEffect('ko')).toBe(true);
  });

  it('throws off shards where a block takes a hit, and many more where it breaks (#50)', () => {
    const blocked = burstFor({ ...hit(0.1), guard: 'blocked' } as GameEvent);
    const broken = burstFor({ ...hit(1), guard: 'broken' } as GameEvent);
    expect(blocked).toMatchObject({ effect: 'guard', x: 1, y: 2 });
    expect(broken?.effect).toBe('guard');
    expect(broken?.count).toBeGreaterThan((blocked?.count ?? 0) * 3);
    expect(hasEffect('guard')).toBe(true);
  });

  it('shows nothing for the end of the match', () => {
    expect(burstFor({ type: 'match-end', winner: 0 })).toBeUndefined();
  });
});
