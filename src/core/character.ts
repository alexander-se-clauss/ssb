import { STICK } from './config';
import { findCharacter } from './registry';
import { BONE_IDS, REST_POSE, plantedBoneSegments } from './skeleton';
import type { CharacterDef } from './types';

/**
 * The definition a fighter plays. `createMatch` rejects unknown ids, so a miss mid-match is a
 * bug, not bad input.
 */
export const characterOf = (characterId: string): CharacterDef => {
  const character = findCharacter(characterId);
  if (!character) throw new Error(`Unknown character "${characterId}"`);
  return character;
};

/** How far the collision box may be off the skeleton's standing height. */
const HEIGHT_TOLERANCE = 0.05;

/**
 * Throws if a definition cannot play: a skeleton missing a bone that poses and hitboxes name,
 * a box height that does not match the body, or stats outside what the rules assume.
 */
export const validateCharacter = (character: CharacterDef): void => {
  const fail = (problem: string) => {
    throw new Error(`Character "${character.id}": ${problem}`);
  };
  const bones = new Set(character.skeleton.bones.map((bone) => bone.id));
  const missing = BONE_IDS.filter((id) => !bones.has(id));
  if (missing.length > 0) fail(`skeleton has no bone for ${missing.join(', ')}`);
  const { stats } = character;
  // Measured on the planted body, the one hurtboxes use: feet on the ground, whatever `hipHeight`.
  const head = plantedBoneSegments(character.skeleton, REST_POSE, { x: 0, y: 0 }, 1).head.end.y;
  if (Math.abs(head - stats.height) > HEIGHT_TOLERANCE) {
    fail(`height ${stats.height} does not match the skeleton's ${head.toFixed(2)}`);
  }
  if (!(stats.weight > 0)) fail('weight must be above 0');
  if (!Number.isInteger(stats.airJumps) || stats.airJumps < 0) {
    fail('air jumps must be a whole number, 0 or more');
  }
  // A longer squat would turn a tap-jump flick plus attack into a jump instead of an up smash.
  if (stats.jumpSquatFrames >= STICK.smashWindowFrames) {
    fail('jump squat must be shorter than the smash window');
  }
};
