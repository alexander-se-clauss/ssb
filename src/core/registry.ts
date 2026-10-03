/**
 * Everything that can be picked in a match, as plain data. Menus list these arrays in order;
 * match configs and game state refer to entries only by id, so they stay serializable.
 */
import { FIGHTER } from './config';
import { HUMANOID } from './skeleton';
import { BATTLEFIELD, FINAL_DESTINATION } from './stages';
import type { CharacterDef, StageDef } from './types';

/**
 * The first fighter: the humanoid body with the stats in `FIGHTER`. It has its ground
 * attacks and aerials; specials are empty until S6.
 */
export const CAPSULE: CharacterDef = {
  id: 'capsule',
  name: 'Capsule',
  stats: FIGHTER,
  skeleton: HUMANOID,
  moves: {
    jab: 'jab',
    forwardTilt: 'forwardTilt',
    upTilt: 'upTilt',
    downTilt: 'downTilt',
    forwardSmash: 'forwardSmash',
    upSmash: 'upSmash',
    downSmash: 'downSmash',
    neutralAir: 'neutralAir',
    forwardAir: 'forwardAir',
    backAir: 'backAir',
    upAir: 'upAir',
    downAir: 'downAir',
    ledgeAttack: 'ledgeAttack',
  },
};

/** A handyman; he plays exactly like the capsule for now (epic #7). */
export const RIVET: CharacterDef = { ...CAPSULE, id: 'rivet', name: 'Rivet' };

/** A bounty hunter in power armour; she plays exactly like the capsule for now (epic #7). */
export const VELA: CharacterDef = { ...CAPSULE, id: 'vela', name: 'Vela' };

export const CHARACTERS: readonly CharacterDef[] = [CAPSULE, RIVET, VELA];

export const STAGES: readonly StageDef[] = [BATTLEFIELD, FINAL_DESTINATION];

export const findCharacter = (id: string): CharacterDef | undefined =>
  CHARACTERS.find((c) => c.id === id);

export const findStage = (id: string): StageDef | undefined => STAGES.find((s) => s.id === id);
