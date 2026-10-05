/**
 * Colours of the F2 debug overlay, as in Melee's hitbox display: yellow where a fighter can be
 * hit, blue where it cannot (invulnerable after a respawn), red where an attack hits, purple where a grab catches (#159). Kept free
 * of Three.js so it can be tested on its own.
 */
import type { FighterState } from '../../core';

export const BOX_COLORS = {
  hurtbox: 0xffe066,
  invulnerable: 0x4da6ff,
  hitbox: 0xff4040,
  grab: 0xb366ff,
} as const;

/** The colour of a fighter's hurtboxes this frame. */
export const hurtboxColor = (fighter: Pick<FighterState, 'invulnerableFrames'>): number =>
  fighter.invulnerableFrames > 0 ? BOX_COLORS.invulnerable : BOX_COLORS.hurtbox;
