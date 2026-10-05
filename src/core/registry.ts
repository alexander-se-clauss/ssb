/**
 * Everything that can be picked in a match, as plain data. Menus list these arrays in order;
 * match configs and game state refer to entries only by id, so they stay serializable.
 */
import { FIGHTER, RIVET_STATS, VELA_STATS } from './config';
import { HUMANOID, STOCKY } from './skeleton';
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
    getupAttack: 'getupAttack',
    grab: 'grab',
    dashGrab: 'dashGrab',
    pivotGrab: 'pivotGrab',
  },
};

/**
 * Fighter 1 (#39): Rivet, a stocky handyman and the all-rounder. The capsule's ground attacks and
 * aerials, plus a lunging haymaker as neutral special, a rising uppercut that recovers, and a
 * block, Iron Guard, as down special (#50).
 */
export const RIVET: CharacterDef = {
  id: 'rivet',
  name: 'Rivet',
  stats: RIVET_STATS,
  skeleton: STOCKY,
  moves: {
    ...CAPSULE.moves,
    neutralSpecial: 'haymaker',
    sideSpecial: 'wrenchToss',
    upSpecial: 'springJack',
    downSpecial: 'ironGuard',
  },
};

/**
 * Fighter 2 (#53): Vela, a bounty hunter in power armour and the contrast to Rivet. Light, quick
 * and floaty with two air jumps; she keeps opponents out with a shot from her arm cannon, recovers
 * with a long thruster boost, and counters, Riposte (#51), where Rivet blocks.
 */
export const VELA: CharacterDef = {
  id: 'vela',
  name: 'Vela',
  stats: VELA_STATS,
  skeleton: HUMANOID,
  moves: {
    ...CAPSULE.moves,
    neutralSpecial: 'pulseShot',
    sideSpecial: 'stasisMine',
    upSpecial: 'thruster',
    downSpecial: 'riposte',
  },
};

export const CHARACTERS: readonly CharacterDef[] = [CAPSULE, RIVET, VELA];

export const STAGES: readonly StageDef[] = [BATTLEFIELD, FINAL_DESTINATION];

export const findCharacter = (id: string): CharacterDef | undefined =>
  CHARACTERS.find((c) => c.id === id);

export const findStage = (id: string): StageDef | undefined => STAGES.find((s) => s.id === id);
