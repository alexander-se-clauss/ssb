/**
 * Everything that can be picked in a match, as plain data. Menus list these arrays in order;
 * match configs and game state refer to entries only by id, so they stay serializable.
 */
import { BATTLEFIELD, FINAL_DESTINATION } from './stages';
import type { CharacterDef, StageDef } from './types';

/**
 * The one fighter so far: the capsule body with the tuning in `FIGHTER`. It has its ground
 * attacks and aerials; specials are empty until S6.
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
    neutralAir: 'neutralAir',
    forwardAir: 'forwardAir',
    backAir: 'backAir',
    upAir: 'upAir',
    downAir: 'downAir',
  },
};

export const CHARACTERS: readonly CharacterDef[] = [CAPSULE];

export const STAGES: readonly StageDef[] = [BATTLEFIELD, FINAL_DESTINATION];

export const findCharacter = (id: string): CharacterDef | undefined =>
  CHARACTERS.find((c) => c.id === id);

export const findStage = (id: string): StageDef | undefined => STAGES.find((s) => s.id === id);
