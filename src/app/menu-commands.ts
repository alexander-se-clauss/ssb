/**
 * Menu commands from a player's controller, for devices that have no key events (gamepads).
 * The stick or d-pad moves the focus, attack confirms and special goes back, as in Melee.
 */
import { pressed, type PlayerInput } from '../core';

export type MenuCommand = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

/** How far the stick must be pushed to count as a menu move. */
const STICK_THRESHOLD = 0.5;

const direction = (value: number): number =>
  value > STICK_THRESHOLD ? 1 : value < -STICK_THRESHOLD ? -1 : 0;

/**
 * The one step a stick position means: a diagonal counts along its stronger axis only.
 * Stick up is +y, but screen rows grow downwards, so up is dy = -1.
 */
export const menuDirection = (input: PlayerInput): { dx: number; dy: number } =>
  Math.abs(input.x) >= Math.abs(input.y)
    ? { dx: direction(input.x), dy: 0 }
    : { dx: 0, dy: -direction(input.y) };

const MOVES: Readonly<Record<string, MenuCommand>> = {
  '0,-1': 'up',
  '0,1': 'down',
  '-1,0': 'left',
  '1,0': 'right',
};

/** The commands one controller gave this frame (presses only, not holds). */
export const menuCommands = (previous: PlayerInput, current: PlayerInput): MenuCommand[] => {
  const commands: MenuCommand[] = [];
  // A move fires whenever the direction changes, so rolling the stick from one direction to
  // another moves again without passing through neutral.
  const now = menuDirection(current);
  const before = menuDirection(previous);
  const move = MOVES[`${now.dx},${now.dy}`];
  if (move && (now.dx !== before.dx || now.dy !== before.dy)) commands.push(move);
  if (pressed(current, previous, 'attack')) commands.push('confirm');
  if (pressed(current, previous, 'special')) commands.push('back');
  return commands;
};
