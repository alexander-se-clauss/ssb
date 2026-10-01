/**
 * Everything that can be picked in a match, as plain data. Menus list these arrays in order;
 * match configs and game state refer to entries only by id, so they stay serializable.
 */
import { BATTLEFIELD, FINAL_DESTINATION } from './stages';
import type { CharacterDef, StageDef } from './types';

/**
 * The one fighter so far: the capsule body with the tuning in `FIGHTER`. It has its ground
 * attacks; until the aerials come (#34) every aerial slot plays the jab, and specials are empty.
 */
export const CAPSULE: CharacterDef = {
  id: 'capsule',
  name: 'Capsule',
  moves: {
    jab: 'jab',
    forwardTilt: 'forwardTilt',
    upTilt: 'upTilt',
    downTilt: 'downTilt',
    forwardSmash: 'forwardSmash',
    upSmash: 'upSmash',
    downSmash: 'downSmash',
    neutralAir: 'jab',
    forwardAir: 'jab',
    backAir: 'jab',
    upAir: 'jab',
    downAir: 'jab',
  },
};

export const CHARACTERS: readonly CharacterDef[] = [CAPSULE];

export const STAGES: readonly StageDef[] = [BATTLEFIELD, FINAL_DESTINATION];

export const findCharacter = (id: string): CharacterDef | undefined =>
  CHARACTERS.find((c) => c.id === id);

export const findStage = (id: string): StageDef | undefined => STAGES.find((s) => s.id === id);
