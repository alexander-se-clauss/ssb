/**
 * Teching, knockdown and getups (#158), as in Melee: what a tumbling fighter does on landing, and
 * the options it has once it lies on the ground.
 */
import { KNOCKDOWN, TECH } from './config';
import { pressed } from './input';
import type { FighterAction, FighterState, PlayerInput } from './types';

/** The actions on the ground after a tumble: a tech, a knockdown, or getting up from one. */
export type DownedAction =
  'tech' | 'techForward' | 'techBack' | 'knockdown' | 'getup' | 'getupForward' | 'getupBack';

export const isDowned = (action: FighterAction): action is DownedAction =>
  action === 'tech' ||
  action === 'techForward' ||
  action === 'techBack' ||
  action === 'knockdown' ||
  action === 'getup' ||
  action === 'getupForward' ||
  action === 'getupBack';

/** A roll forward (the way the fighter faces) or back for a stick held past `TECH.stick`. */
const rollWay = (x: number, facing: 1 | -1): 1 | -1 | 0 =>
  x * facing >= TECH.stick ? 1 : x * facing <= -TECH.stick ? -1 : 0;

/** How a tumbling fighter lands: a tech if its window is open, the way the stick holds. */
export const landTumble = (
  techWindow: number,
  input: PlayerInput,
  facing: 1 | -1,
): 'tech' | 'techForward' | 'techBack' | 'knockdown' => {
  if (techWindow <= 0) return 'knockdown';
  const way = rollWay(input.x, facing);
  return way === 1 ? 'techForward' : way === -1 ? 'techBack' : 'tech';
};

/** What a fighter lying after a knockdown does with this frame's input, if anything. */
export const getupOption = (
  input: PlayerInput,
  previous: PlayerInput,
  facing: 1 | -1,
): 'getup' | 'getupForward' | 'getupBack' | 'getupAttack' | null => {
  if (pressed(input, previous, 'attack') || pressed(input, previous, 'special')) {
    return 'getupAttack';
  }
  const way = rollWay(input.x, facing);
  if (way !== 0) return way === 1 ? 'getupForward' : 'getupBack';
  if (input.y >= TECH.stick || pressed(input, previous, 'jump')) return 'getup';
  return null;
};

/** The frame data of a tech or getup: length, invulnerability, and how far it travels which way. */
export const downedFrames = (
  action: Exclude<DownedAction, 'knockdown'>,
): {
  readonly totalFrames: number;
  readonly invulnerableFrames: number;
  readonly moveTo: number;
  readonly distance: number;
  readonly way: 1 | -1 | 0;
} => {
  switch (action) {
    case 'tech':
      return { ...TECH.inPlace, moveTo: 0, distance: 0, way: 0 };
    case 'techForward':
    case 'techBack':
      return { ...TECH.roll, way: action === 'techForward' ? 1 : -1 };
    case 'getup':
      return { ...KNOCKDOWN.getup, moveTo: 0, distance: 0, way: 0 };
    case 'getupForward':
    case 'getupBack':
      return { ...KNOCKDOWN.roll, way: action === 'getupForward' ? 1 : -1 };
  }
};

/**
 * The tech window and lockout after this frame: a dodge press in the air opens the window unless
 * a recent press locks it out. Both count down, except while `frozen` by hitlag, when a press
 * still opens the window.
 */
export const techTimers = (
  fighter: Pick<FighterState, 'techWindow' | 'techLockout' | 'grounded'>,
  dodgePress: boolean,
  frozen = false,
): { techWindow: number; techLockout: number } => {
  const age = frozen ? 0 : 1;
  const techLockout = Math.max(fighter.techLockout - age, 0);
  if (dodgePress && !fighter.grounded && techLockout === 0) {
    return { techWindow: TECH.windowFrames, techLockout: TECH.lockoutFrames };
  }
  return { techWindow: Math.max(fighter.techWindow - age, 0), techLockout };
};
