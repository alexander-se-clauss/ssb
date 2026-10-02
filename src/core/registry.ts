/**
 * Everything that can be picked in a match, as plain data. Menus list these arrays in order;
 * match configs and game state refer to entries only by id, so they stay serializable.
 */
import { BATTLEFIELD, FINAL_DESTINATION } from './stages';
import type { CharacterDef, StageDef } from './types';

/**
 * The first fighter: the capsule body with the tuning in `FIGHTER`. It has its ground
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

/** A handyman on the shared skeleton; he borrows the capsule's moves for now (epic #7). */
export const RIVET: CharacterDef = { id: 'rivet', name: 'Rivet', moves: CAPSULE.moves };

export const CHARACTERS: readonly CharacterDef[] = [CAPSULE, RIVET];

export const STAGES: readonly StageDef[] = [BATTLEFIELD, FINAL_DESTINATION];

export const findCharacter = (id: string): CharacterDef | undefined =>
  CHARACTERS.find((c) => c.id === id);

export const findStage = (id: string): StageDef | undefined => STAGES.find((s) => s.id === id);
