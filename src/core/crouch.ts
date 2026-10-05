/** Crouching (#156): what crouch cancel and the crouch pose both ask. */
import { CROUCH } from './config';
import type { FighterState } from './types';

/** Standing still on the ground with the stick held down. */
export const isCrouching = (fighter: FighterState): boolean =>
  fighter.grounded && fighter.action === 'idle' && fighter.previousInput.y <= -CROUCH.stick;
