import { describe, expect, it, vi } from 'vitest';
import { validateCharacter } from './character';
import { hurtboxes } from './combat';
import { FIGHTER } from './config';
import { CAPSULE, CHARACTERS } from './registry';
import { HUMANOID, type SkeletonDef } from './skeleton';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type * as Registry from './registry';
import type { CharacterDef, MatchState } from './types';

// Test-only characters next to the real roster, built from the capsule's definition.
vi.mock('./registry', async (importOriginal) => {
  const real = await importOriginal<typeof Registry>();
  const base = real.CAPSULE;
  const tall: SkeletonDef = {
    ...base.skeleton,
    hipHeight: base.skeleton.hipHeight * 1.5,
    bones: base.skeleton.bones.map((bone) => ({ ...bone, length: bone.length * 1.5 })),
  };
  const extra: CharacterDef[] = [
    { ...base, id: 'heavy', name: 'Heavy', stats: { ...base.stats, weight: 2 } },
    { ...base, id: 'floaty', name: 'Floaty', stats: { ...base.stats, gravity: 0.006 } },
    { ...base, id: 'quick', name: 'Quick', stats: { ...base.stats, walkSpeed: 0.28 } },
    {
      ...base,
      id: 'tall',
      name: 'Tall',
      stats: { ...base.stats, height: base.stats.height * 1.5 },
      skeleton: tall,
    },
  ];
  const all = [...real.CHARACTERS, ...extra];
  return { ...real, CHARACTERS: all, findCharacter: (id: string) => all.find((c) => c.id === id) };
});

/** P1 (capsule) on the main stage facing right, P2 (`target`) right next to it. */
const faceOff = (target: string): MatchState => {
  let state = run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: CAPSULE.id }, { characterId: target }],
      rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
      countdownFrames: 0,
    }),
    120,
  );
  state = withFighter(state, 0, { position: { x: 0, y: 0 }, facing: 1, grounded: true });
  state = withFighter(state, 1, { position: { x: 0.8, y: 0 }, facing: -1, grounded: true });
  return state;
};

/** One fighter of the given character, alone on Battlefield. */
const solo = (characterId: string): MatchState =>
  createMatch({
    stageId: BATTLEFIELD.id,
    players: [{ characterId }],
    rules: { mode: 'stock', stocks: 3, timeLimitSeconds: 120 },
    countdownFrames: 0,
  });

describe('character definitions', () => {
  it('express the capsule entirely as data: stats, skeleton and moves', () => {
    expect(CAPSULE.stats).toBe(FIGHTER);
    expect(CAPSULE.skeleton).toBe(HUMANOID);
    expect(CAPSULE.moves.jab).toBe('jab');
  });

  it('are all playable as registered', () => {
    for (const character of CHARACTERS) expect(() => validateCharacter(character)).not.toThrow();
  });

  it('reject a skeleton without every bone, a box that does not fit it, or odd stats', () => {
    const bones = CAPSULE.skeleton.bones.filter((bone) => bone.id !== 'lowerArmBack');
    const check = (patch: Partial<CharacterDef>) => () =>
      validateCharacter({ ...CAPSULE, ...patch });
    expect(check({ skeleton: { ...CAPSULE.skeleton, bones } })).toThrow(/no bone for lowerArmBack/);
    expect(check({ stats: { ...FIGHTER, height: 2.2 } })).toThrow(/height/);
    // Longer legs on the same hip height: planted on its feet, the body stands taller.
    const longLegs = CAPSULE.skeleton.bones.map((bone) =>
      bone.id.includes('Leg') ? { ...bone, length: bone.length + 0.1 } : bone,
    );
    expect(check({ skeleton: { ...CAPSULE.skeleton, bones: longLegs } })).toThrow(/height/);
    expect(check({ stats: { ...FIGHTER, weight: 0 } })).toThrow(/weight/);
    expect(check({ stats: { ...FIGHTER, totalJumps: 0 } })).toThrow(/ground jump/);
    expect(check({ stats: { ...FIGHTER, jumpSquatFrames: 9 } })).toThrow(/jump squat/);
  });

  it('launch a heavier character less far from the same hit', () => {
    const jab = [inputOf({ attack: true }), inputOf({})];
    const light = run(faceOff(CAPSULE.id), 4, jab);
    const heavy = run(faceOff('heavy'), 4, jab);
    expect(fighter(light, 1).action).toBe('hitstun');
    expect(fighter(heavy, 1).action).toBe('hitstun');
    expect(fighter(heavy, 1).velocity.x).toBeCloseTo(fighter(light, 1).velocity.x / 2);
    expect(fighter(heavy, 1).hitstunFrames).toBeLessThan(fighter(light, 1).hitstunFrames);
  });

  it('let a character with lower gravity fall more slowly', () => {
    const capsule = fighter(run(solo(CAPSULE.id), 10), 0);
    const floaty = fighter(run(solo('floaty'), 10), 0);
    expect(floaty.position.y).toBeGreaterThan(capsule.position.y);
  });

  it('let a faster character walk further', () => {
    const right = [inputOf({ x: 1 })];
    const walked = (id: string) => {
      const start = withFighter(run(solo(id), 120), 0, { position: { x: -6, y: 0 } });
      return fighter(run(start, 30, right), 0).position.x - fighter(start, 0).position.x;
    };
    expect(walked('quick')).toBeGreaterThan(walked(CAPSULE.id) * 1.5);
  });

  it('build hurtboxes from the character’s own skeleton', () => {
    const top = (state: MatchState) =>
      Math.max(...hurtboxes(fighter(state, 0)).map((h) => Math.max(h.start.y, h.end.y) + h.radius));
    const capsule = run(solo(CAPSULE.id), 120);
    const tall = run(solo('tall'), 120);
    expect(top(tall) - fighter(tall, 0).position.y).toBeGreaterThan(
      (top(capsule) - fighter(capsule, 0).position.y) * 1.3,
    );
  });
});
