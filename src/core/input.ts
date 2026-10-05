import type { PlayerInput } from './types';

export const NEUTRAL_INPUT: PlayerInput = {
  x: 0,
  y: 0,
  jump: false,
  attack: false,
  special: false,
  shield: false,
  shortHop: false,
  grab: false,
  start: false,
};

export const inputOf = (partial: Partial<PlayerInput>): PlayerInput => ({
  ...NEUTRAL_INPUT,
  ...partial,
});

/** True on the first frame a button is held. */
export const pressed = (
  current: PlayerInput,
  previous: PlayerInput,
  button: 'jump' | 'attack' | 'special' | 'shield' | 'shortHop' | 'grab' | 'start',
): boolean => current[button] && !previous[button];
