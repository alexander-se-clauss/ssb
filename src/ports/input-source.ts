import type { PlayerInput } from '../core';

/**
 * Anything that can produce a player's input for the current frame:
 * keyboard, gamepad, touch, an AI bot, a replay file, or a remote player.
 */
export interface InputSource {
  sample(): PlayerInput;
  dispose(): void;
}
