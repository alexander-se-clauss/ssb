import { describe, expect, it } from 'vitest';
import { CHARACTERS, STAGES, findCharacter, findStage } from './registry';
import { createMatch } from './simulation';
import { BATTLEFIELD } from './stages';

describe('character and stage registry', () => {
  it('lists the capsule fighter and Battlefield', () => {
    expect(CHARACTERS.map((c) => c.id)).toContain('capsule');
    expect(STAGES.map((s) => s.id)).toContain('battlefield');
  });

  it('has unique ids', () => {
    const unique = (ids: string[]) => new Set(ids).size === ids.length;
    expect(unique(CHARACTERS.map((c) => c.id))).toBe(true);
    expect(unique(STAGES.map((s) => s.id))).toBe(true);
  });

  it('looks entries up by id and returns undefined for unknown ids', () => {
    expect(findStage('battlefield')).toBe(BATTLEFIELD);
    expect(findCharacter('capsule')?.name).toBe('Capsule');
    expect(findStage('final-destination')).toBeUndefined();
    expect(findCharacter('mario')).toBeUndefined();
  });
});

describe('match setup from registry ids', () => {
  const setup = {
    stageId: 'battlefield',
    players: [{ characterId: 'capsule' }, { characterId: 'capsule' }],
    stocks: 3,
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

  it('rejects a match without players', () => {
    expect(() => createMatch({ ...setup, players: [] })).toThrow(/at least one player/);
  });
});
