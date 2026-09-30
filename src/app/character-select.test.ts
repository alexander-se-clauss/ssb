import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, inputOf, type CharacterDef } from '../core';
import {
  allReady,
  createSelect,
  menuActions,
  reduceSelect,
  type SelectAction,
  type SelectState,
} from './character-select';

const ROSTER: CharacterDef[] = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
  { id: 'd', name: 'D' },
  { id: 'e', name: 'E' },
];
const COLUMNS = 4;

const apply = (state: SelectState, ...actions: SelectAction[]): SelectState =>
  actions.reduce((s, action) => reduceSelect(s, action, ROSTER, COLUMNS), state);

describe('character select', () => {
  it('starts with every cursor on the first character and nobody picked', () => {
    const state = createSelect(2);
    expect(state.cursors).toEqual([0, 0]);
    expect(state.picks).toEqual([null, null]);
    expect(allReady(state)).toBe(false);
  });

  it('moves each cursor through the grid, wrapping around', () => {
    const state = apply(createSelect(2), { type: 'move', player: 0, dx: 1, dy: 0 });
    expect(state.cursors).toEqual([1, 0]);
    expect(apply(state, { type: 'move', player: 0, dx: 0, dy: 1 }).cursors[0]).toBe(4);
    expect(apply(createSelect(2), { type: 'move', player: 1, dx: -1, dy: 0 }).cursors[1]).toBe(4);
  });

  it('picks the character under the cursor and is ready when everyone picked', () => {
    let state = apply(
      createSelect(2),
      { type: 'move', player: 1, dx: 1, dy: 0 },
      { type: 'confirm', player: 0 },
    );
    expect(state.picks).toEqual(['a', null]);
    expect(allReady(state)).toBe(false);
    state = apply(state, { type: 'confirm', player: 1 });
    expect(state.picks).toEqual(['a', 'b']);
    expect(allReady(state)).toBe(true);
  });

  it('lets a player change their mind: cancel, move, pick again', () => {
    const state = apply(
      createSelect(2),
      { type: 'confirm', player: 0 },
      { type: 'cancel', player: 0 },
      { type: 'move', player: 0, dx: 1, dy: 0 },
      { type: 'confirm', player: 0 },
    );
    expect(state.picks[0]).toBe('b');
  });

  it('keeps the cursor still while a player has picked', () => {
    const state = apply(
      createSelect(2),
      { type: 'confirm', player: 0 },
      { type: 'move', player: 0, dx: 1, dy: 0 },
    );
    expect(state.cursors[0]).toBe(0);
  });

  it('lets two players pick the same character', () => {
    const state = apply(
      createSelect(2),
      { type: 'confirm', player: 0 },
      { type: 'confirm', player: 1 },
    );
    expect(state.picks).toEqual(['a', 'a']);
  });
});

describe('menu actions from a player controller', () => {
  it('turns a fresh stick push into one move', () => {
    expect(menuActions(1, NEUTRAL_INPUT, inputOf({ x: 1 }))).toEqual([
      { type: 'move', player: 1, dx: 1, dy: 0 },
    ]);
    expect(menuActions(1, inputOf({ x: 1 }), inputOf({ x: 1 }))).toEqual([]);
  });

  it('moves one step along the stronger axis of a diagonal push', () => {
    expect(menuActions(0, NEUTRAL_INPUT, inputOf({ x: 1, y: 0.6 }))).toEqual([
      { type: 'move', player: 0, dx: 1, dy: 0 },
    ]);
  });

  it('moves again when rolling from one direction to another without neutral', () => {
    const right = inputOf({ x: 1 });
    const rightAndUp = inputOf({ x: 1, y: 1 });
    const up = inputOf({ y: 1 });
    expect(menuActions(0, right, rightAndUp)).toEqual([]);
    expect(menuActions(0, rightAndUp, up)).toEqual([{ type: 'move', player: 0, dx: 0, dy: -1 }]);
    expect(menuActions(0, inputOf({ x: 1, y: 0.2 }), inputOf({ x: 0.2, y: 1 }))).toEqual([
      { type: 'move', player: 0, dx: 0, dy: -1 },
    ]);
  });

  it('maps up on the stick to moving up the grid', () => {
    expect(menuActions(0, NEUTRAL_INPUT, inputOf({ y: 1, jump: true }))).toEqual([
      { type: 'move', player: 0, dx: 0, dy: -1 },
    ]);
  });

  it('uses attack to confirm and special to cancel, on press only', () => {
    expect(menuActions(0, NEUTRAL_INPUT, inputOf({ attack: true }))).toEqual([
      { type: 'confirm', player: 0 },
    ]);
    expect(menuActions(0, NEUTRAL_INPUT, inputOf({ special: true }))).toEqual([
      { type: 'cancel', player: 0 },
    ]);
    expect(menuActions(0, inputOf({ attack: true }), inputOf({ attack: true }))).toEqual([]);
  });
});
