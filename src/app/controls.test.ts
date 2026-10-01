import { describe, expect, it } from 'vitest';
import { controlRows, type ControlLabels } from './controls';

const P1: ControlLabels = {
  move: 'A / D',
  jump: 'W',
  down: 'S',
  attack: 'F',
  special: 'G',
  start: 'Enter',
};
const P2: ControlLabels = {
  move: '← / →',
  jump: '↑',
  down: '↓',
  attack: '.',
  special: '/',
  start: 'Enter',
};

describe('controls screen', () => {
  it('lists each action with every player’s key and what it does in menus', () => {
    expect(controlRows([P1, P2])).toEqual([
      ['Move', 'A / D', '← / →'],
      ['Jump', 'W', '↑'],
      ['Drop / fast-fall', 'S', '↓'],
      ['Attack · pick in menus', 'F', '.'],
      ['Special · cancel in menus', 'G', '/'],
      ['Start · start the match', 'Enter', 'Enter'],
    ]);
  });
});
