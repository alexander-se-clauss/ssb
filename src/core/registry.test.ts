import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from './config';
import { CHARACTERS, STAGES, findCharacter, findStage } from './registry';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';

describe('character and stage registry', () => {
  it('lists the capsule fighter and Battlefield', () => {
    expect(CHARACTERS.map((c) => c.id)).toContain('capsule');
    expect(STAGES.map((s) => s.id)).toContain('battlefield');
  });

  it('gives Vela the capsule moveset until she gets her own, and Rivet its normals (#39)', () => {
    expect(findCharacter('vela')?.moves).toEqual(findCharacter('capsule')?.moves);
    expect(findCharacter('rivet')?.moves).toMatchObject(findCharacter('capsule')?.moves ?? {});
  });

  it('has unique ids', () => {
    const unique = (ids: string[]) => new Set(ids).size === ids.length;
    expect(unique(CHARACTERS.map((c) => c.id))).toBe(true);
    expect(unique(STAGES.map((s) => s.id))).toBe(true);
  });

  it('looks entries up by id and returns undefined for unknown ids', () => {
    expect(findStage('battlefield')).toBe(BATTLEFIELD);
    expect(findCharacter('capsule')?.name).toBe('Capsule');
    expect(findStage('hyrule-temple')).toBeUndefined();
    expect(findCharacter('nobody')).toBeUndefined();
  });
});

describe('match setup from registry ids', () => {
  const setup = {
    stageId: 'battlefield',
    players: [{ characterId: 'capsule' }, { characterId: 'capsule' }],
    rules: DEFAULT_RULES,
  };

  it('resolves the stage and gives each fighter its character', () => {
    const state = createMatch(setup);
    expect(state.stage).toBe(BATTLEFIELD);
    expect(state.fighters.map((f) => f.characterId)).toEqual(['capsule', 'capsule']);
  });

  it('rejects an unknown stage id', () => {
    expect(() => createMatch({ ...setup, stageId: 'nowhere' })).toThrow(/unknown stage "nowhere"/i);
  });

  it('rejects an unknown character id', () => {
    const players = [{ characterId: 'capsule' }, { characterId: 'nobody' }];
    expect(() => createMatch({ ...setup, players })).toThrow(/unknown character "nobody"/i);
  });

  it('accepts up to 99 lives and 60 minutes, and nothing beyond', () => {
    const rules = (stocks: number, timeLimitSeconds: number) => ({
      ...setup,
      rules: { mode: 'stock' as const, stocks, timeLimitSeconds },
    });
    expect(() => createMatch(rules(99, 3600))).not.toThrow();
    expect(() => createMatch(rules(1, 60))).not.toThrow();
    expect(() => createMatch(rules(100, 120))).toThrow(/stocks out of range/i);
    expect(() => createMatch(rules(3, 3660))).toThrow(/time limit out of range/i);
    expect(() => createMatch(rules(0, 120))).toThrow(/stocks out of range/i);
  });

  it('rejects a match without players', () => {
    expect(() => createMatch({ ...setup, players: [] })).toThrow(/at least one player/);
  });
});

describe('stage data', () => {
  it('offers more than one stage to choose from', () => {
    expect(STAGES.length).toBeGreaterThan(1);
  });

  it.each(STAGES.map((stage) => [stage.id, stage] as const))(
    '%s has a platform under every spawn point, inside the blast zone',
    (_id, stage) => {
      expect(stage.spawnPoints.length).toBeGreaterThanOrEqual(2);
      const zone = stage.blastZone;
      for (const spawn of stage.spawnPoints) {
        expect(spawn.x).toBeGreaterThan(zone.left);
        expect(spawn.x).toBeLessThan(zone.right);
        expect(spawn.y).toBeLessThan(zone.top);
        const below = stage.platforms.some(
          (p) => spawn.x >= p.bounds.left && spawn.x <= p.bounds.right && p.bounds.top <= spawn.y,
        );
        expect(below).toBe(true);
      }
    },
  );

  it.each(STAGES.map((stage) => [stage.id, stage] as const))(
    '%s leaves room to fight and recover beyond the ledges (#42)',
    (_id, stage) => {
      const main = stage.platforms.find((p) => !p.passThrough);
      if (!main) throw new Error('Expected a main stage');
      const halfWidth = (main.bounds.right - main.bounds.left) / 2;
      const zone = stage.blastZone;
      // Melee's stages leave about twice the stage's half width beside each ledge.
      expect(zone.right - main.bounds.right).toBeGreaterThanOrEqual(halfWidth * 1.8);
      expect(main.bounds.left - zone.left).toBeGreaterThanOrEqual(halfWidth * 1.8);
      expect(zone.top - main.bounds.top).toBeGreaterThanOrEqual(18);
      expect(main.bounds.top - zone.bottom).toBeGreaterThanOrEqual(10);
    },
  );

  it('starts a match on the chosen stage', () => {
    const other = STAGES[1];
    if (!other) throw new Error('Expected a second stage');
    const state = createMatch({
      stageId: other.id,
      players: [{ characterId: 'capsule' }, { characterId: 'capsule' }],
      rules: DEFAULT_RULES,
    });
    expect(state.stage.id).toBe(other.id);
  });
});
