import { describe, expect, it } from 'vitest';
import { controlRows, type ControlLabels } from './controls';

const P1: ControlLabels = {
  move: 'A / D',
  jump: 'Space',
  up: 'W',
  down: 'S',
  attack: 'F',
  special: 'G',
  dodge: 'H',
  shortHop: 'V',
  start: 'Enter',
};
const P2: ControlLabels = {
  move: '← / →',
  jump: 'Num 0',
  up: '↑',
  down: '↓',
  attack: '.',
  special: '/',
  dodge: 'Right Shift',
  shortHop: 'Num 1',
  start: 'Enter',
};

describe('controls screen', () => {
  it('lists each action with every player’s key and what it does in menus', () => {
    expect(controlRows([P1, P2])).toEqual([
      ['Move', 'A / D', '← / →'],
      ['Jump', 'Space', 'Num 0'],
      ['Short hop', 'V', 'Num 1'],
      ['Aim up (up tilt, up smash)', 'W', '↑'],
      ['Drop / fast-fall', 'S', '↓'],
      ['Attack · pick in menus', 'F', '.'],
      ['Special · cancel in menus', 'G', '/'],
      ['Dodge (sidestep; roll with left or right; air dodge)', 'H', 'Right Shift'],
      ['Start · start the match', 'Enter', 'Enter'],
    ]);
  });
});
