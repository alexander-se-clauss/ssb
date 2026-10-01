import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, inputOf, type CharacterDef } from '../core';
import {
  RULES_CURSOR,
  allReady,
  createSelect,
  menuActions,
  reduceSelect,
  selectOutcome,
  slotOf,
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

/** Two slots, joined by devices 0 and 1. */
const twoPlayers = (): SelectState =>
  apply(createSelect(2), { type: 'join', device: 0 }, { type: 'join', device: 1 });

describe('character select', () => {
  it('starts with every slot empty, so nobody is ready', () => {
    const state = createSelect(4);
    expect(state.devices).toEqual([null, null, null, null]);
    expect(state.picks).toEqual([null, null, null, null]);
    expect(state.rulesOpen).toBe(false);
    expect(allReady(state)).toBe(false);
  });
});

describe('joining on character select', () => {
  it('gives a device that presses a button the first free slot, without picking yet', () => {
    const state = apply(createSelect(4), { type: 'join', device: 3 }, { type: 'join', device: 0 });
    expect(state.devices).toEqual([3, 0, null, null]);
    expect(state.picks).toEqual([null, null, null, null]);
    expect(slotOf(state, 0)).toBe(1);
    expect(slotOf(state, 5)).toBe(-1);
  });

  it('joins each device once and stops when every slot is taken', () => {
    const full = apply(
      createSelect(2),
      { type: 'join', device: 0 },
      { type: 'join', device: 0 },
      { type: 'join', device: 1 },
      { type: 'join', device: 2 },
    );
    expect(full.devices).toEqual([0, 1]);
  });

  it('leaves the slot when a player without a pick cancels; later players move up', () => {
    const three = apply(
      createSelect(4),
      { type: 'join', device: 0 },
      { type: 'join', device: 1 },
      { type: 'join', device: 2 },
      { type: 'move', player: 2, dx: 1, dy: 0 },
      { type: 'confirm', player: 2 },
    );
    const left = apply(three, { type: 'cancel', player: 0 });
    expect(left.devices).toEqual([1, 2, null, null]);
    // P3 moved up to P2 with their cursor and pick.
    expect(left.cursors[1]).toBe(1);
    expect(left.picks).toEqual([null, 'b', null, null]);
    expect(apply(left, { type: 'join', device: 4 }).devices).toEqual([1, 2, 4, null]);
  });

  it('ignores moves and picks for an empty slot', () => {
    const state = createSelect(2);
    expect(
      apply(state, { type: 'confirm', player: 0 }, { type: 'move', player: 1, dx: 1, dy: 0 }),
    ).toEqual(state);
  });

  it('is ready once every joined player picked, even alone', () => {
    const alone = apply(
      createSelect(4),
      { type: 'join', device: 2 },
      { type: 'confirm', player: 0 },
    );
    expect(allReady(alone)).toBe(true);
  });

  it('moves each cursor through the grid, wrapping around', () => {
    const state = apply(twoPlayers(), { type: 'move', player: 0, dx: 1, dy: 0 });
    expect(state.cursors).toEqual([1, 0]);
    expect(apply(state, { type: 'move', player: 0, dx: 0, dy: 1 }).cursors[0]).toBe(4);
    expect(apply(twoPlayers(), { type: 'move', player: 1, dx: -1, dy: 0 }).cursors[1]).toBe(4);
  });

  it('picks the character under the cursor and is ready when everyone picked', () => {
    let state = apply(
      twoPlayers(),
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
      twoPlayers(),
      { type: 'confirm', player: 0 },
      { type: 'cancel', player: 0 },
      { type: 'move', player: 0, dx: 1, dy: 0 },
      { type: 'confirm', player: 0 },
    );
    expect(state.picks[0]).toBe('b');
  });

  it('lets a player move on after picking, as in Melee, keeping the pick', () => {
    const state = apply(
      twoPlayers(),
      { type: 'confirm', player: 0 },
      { type: 'move', player: 0, dx: 1, dy: 0 },
      { type: 'confirm', player: 0 },
    );
    expect(state.cursors[0]).toBe(1);
    expect(state.picks[0]).toBe('a');
  });

  it('lets two players pick the same character', () => {
    const state = apply(
      twoPlayers(),
      { type: 'confirm', player: 0 },
      { type: 'confirm', player: 1 },
    );
    expect(state.picks).toEqual(['a', 'a']);
  });
});

describe('rules banner on character select', () => {
  const up = (player: 0 | 1): SelectAction => ({ type: 'move', player, dx: 0, dy: -1 });
  const down = (player: 0 | 1): SelectAction => ({ type: 'move', player, dx: 0, dy: 1 });

  it('moves a cursor from the top row up onto the rules banner and back down', () => {
    const onBanner = apply(twoPlayers(), { type: 'move', player: 0, dx: 1, dy: 0 }, up(0));
    expect(onBanner.cursors[0]).toBe(RULES_CURSOR);
    expect(apply(onBanner, up(0)).cursors[0]).toBe(RULES_CURSOR);
    expect(apply(onBanner, { type: 'move', player: 0, dx: 1, dy: 0 }).cursors[0]).toBe(
      RULES_CURSOR,
    );
    expect(apply(onBanner, down(0)).cursors[0]).toBe(0);
  });

  it('opens the rules when a player picks the banner, without picking a fighter', () => {
    const state = apply(twoPlayers(), up(1), { type: 'confirm', player: 1 });
    expect(state.rulesOpen).toBe(true);
    expect(state.picks).toEqual([null, null]);
  });

  it('lets a player who already picked open the rules', () => {
    const state = apply(twoPlayers(), { type: 'confirm', player: 0 }, up(0), {
      type: 'confirm',
      player: 0,
    });
    expect(state.rulesOpen).toBe(true);
    expect(state.picks[0]).toBe('a');
  });

  it('closes the rules when a player presses special', () => {
    const open = apply(twoPlayers(), { type: 'rules', open: true });
    const closed = apply(open, { type: 'cancel', player: 1 });
    expect(closed.rulesOpen).toBe(false);
  });

  it('ignores players while the rules are open, until they are closed', () => {
    const open = apply(twoPlayers(), { type: 'rules', open: true });
    expect(open.rulesOpen).toBe(true);
    const still = apply(
      open,
      { type: 'confirm', player: 0 },
      { type: 'move', player: 1, dx: 1, dy: 0 },
    );
    expect(still).toEqual(open);
    const closed = apply(open, { type: 'rules', open: false }, { type: 'confirm', player: 0 });
    expect(closed.rulesOpen).toBe(false);
    expect(closed.picks[0]).toBe('a');
  });
});

describe('starting from a controller', () => {
  const ready = apply(twoPlayers(), { type: 'confirm', player: 0 }, { type: 'confirm', player: 1 });

  it('starts once everyone has picked and someone confirms again', () => {
    expect(selectOutcome(ready, { type: 'confirm', player: 1 })).toBe('start');
    const half = apply(twoPlayers(), { type: 'confirm', player: 0 });
    expect(selectOutcome(half, { type: 'confirm', player: 0 })).toBeNull();
  });

  it('opens the rules instead of starting when the confirming cursor is on the banner', () => {
    const onBanner = apply(ready, { type: 'move', player: 0, dx: 0, dy: -1 });
    expect(selectOutcome(onBanner, { type: 'confirm', player: 0 })).toBeNull();
  });

  it('does not start from an empty slot or while the rules are open', () => {
    const third = apply(
      createSelect(3),
      { type: 'join', device: 0 },
      { type: 'confirm', player: 0 },
    );
    expect(selectOutcome(third, { type: 'confirm', player: 2 })).toBeNull();
    const open = apply(ready, { type: 'rules', open: true });
    expect(selectOutcome(open, { type: 'confirm', player: 0 })).toBeNull();
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
