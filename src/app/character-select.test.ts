import { describe, expect, it } from 'vitest';
import { CAPSULE, NEUTRAL_INPUT, inputOf, type CharacterDef } from '../core';
import {
  RULES_CURSOR,
  previewCharacter,
  BACK_CURSOR,
  allReady,
  createSelect,
  lobbyStands,
  menuActions,
  canStart,
  reduceSelect,
  requestsStart,
  requestsBack,
  slotOf,
  type SelectAction,
  type SelectState,
} from './character-select';

const ROSTER: CharacterDef[] = [
  { ...CAPSULE, id: 'a', name: 'A', moves: {} },
  { ...CAPSULE, id: 'b', name: 'B', moves: {} },
  { ...CAPSULE, id: 'c', name: 'C', moves: {} },
  { ...CAPSULE, id: 'd', name: 'D', moves: {} },
  { ...CAPSULE, id: 'e', name: 'E', moves: {} },
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

  it('is ready once at least two players joined and every joined player picked', () => {
    const alone = apply(
      createSelect(4),
      { type: 'join', device: 2 },
      { type: 'confirm', player: 0 },
    );
    expect(allReady(alone)).toBe(false);
    const two = apply(alone, { type: 'join', device: 5 });
    expect(allReady(two)).toBe(false);
    expect(allReady(apply(two, { type: 'confirm', player: 1 }))).toBe(true);
  });

  it('is ready with one player for training, who fights the dummy', () => {
    const alone = apply(
      createSelect(4, 1),
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

  it('reaches Back to the left of rules and returns without losing a pick', () => {
    const state = apply(twoPlayers(), { type: 'confirm', player: 0 }, up(0), {
      type: 'move',
      player: 0,
      dx: -1,
      dy: 0,
    });
    expect(state.cursors[0]).toBe(BACK_CURSOR);
    expect(state.picks[0]).toBe('a');
    expect(requestsBack(state, { type: 'confirm', player: 0 })).toBe(true);
    expect(requestsStart(state, { type: 'confirm', player: 0 })).toBe(false);
    expect(apply(state, { type: 'move', player: 0, dx: 1, dy: 0 }).cursors[0]).toBe(RULES_CURSOR);
    expect(apply(state, down(0)).cursors[0]).toBe(0);
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

describe('browsing character select before joining', () => {
  it('reaches and opens rules without registering a player', () => {
    const state = apply(createSelect(4), { type: 'guest-move', device: 3, dx: 0, dy: -1 });
    expect(state.guestCursors[3]).toBe(RULES_CURSOR);
    const open = apply(state, { type: 'guest-confirm', device: 3 });
    expect(open.rulesOpen).toBe(true);
    expect(open.devices).toEqual([null, null, null, null]);
  });

  it('can reach Back and requests navigation instead of joining', () => {
    const state = apply(
      createSelect(4),
      { type: 'guest-move', device: 0, dx: 0, dy: -1 },
      { type: 'guest-move', device: 0, dx: -1, dy: 0 },
    );
    const action: SelectAction = { type: 'guest-confirm', device: 0 };
    expect(state.guestCursors[0]).toBe(BACK_CURSOR);
    expect(requestsBack(state, action)).toBe(true);
    expect(apply(state, action).devices).toEqual([null, null, null, null]);
  });

  it('restricts unjoined cursors to header actions and clears focus to join', () => {
    let state = createSelect(4);
    for (const [dx, dy] of [
      [1, 0],
      [0, -1],
      [-1, 0],
      [1, 0],
    ]) {
      state = apply(state, { type: 'guest-move', device: 0, dx: dx ?? 0, dy: dy ?? 0 });
      expect([RULES_CURSOR, BACK_CURSOR]).toContain(state.guestCursors[0]);
      expect(state.devices).toEqual([null, null, null, null]);
    }
    state = apply(state, { type: 'guest-move', device: 3, dx: 0, dy: -1 });
    const cleared = apply(state, { type: 'guest-move', device: 0, dx: 0, dy: 1 });
    expect(cleared.guestCursors).toEqual({ 3: RULES_CURSOR });
    const joined = apply(cleared, { type: 'guest-confirm', device: 0 });
    expect(joined.devices).toEqual([0, null, null, null]);
    expect(joined.cursors[0]).toBe(0);
    expect(joined.guestCursors).toEqual({ 3: RULES_CURSOR });
    expect(apply(joined, { type: 'confirm', player: 0 }).picks[0]).toBe('a');
  });

  it('pauses guest navigation while rules are open', () => {
    const state = apply(createSelect(4), { type: 'rules', open: true });
    expect(
      apply(
        state,
        { type: 'guest-move', device: 0, dx: 1, dy: 0 },
        { type: 'guest-confirm', device: 3 },
      ),
    ).toEqual(state);
  });
});

describe('starting from a controller', () => {
  const ready = apply(twoPlayers(), { type: 'confirm', player: 0 }, { type: 'confirm', player: 1 });
  const confirm = (player: 0 | 1 | 2): SelectAction => ({ type: 'confirm', player });

  it('asks to start when a player who already picked confirms again', () => {
    const half = apply(twoPlayers(), confirm(0));
    expect(requestsStart(half, confirm(0))).toBe(true);
    // Their own first pick is a pick, not a start request.
    expect(requestsStart(half, confirm(1))).toBe(false);
    expect(requestsStart(ready, { type: 'cancel', player: 0 })).toBe(false);
  });

  it('does not ask to start from the banner, an empty slot or while the rules are open', () => {
    const onBanner = apply(ready, { type: 'move', player: 0, dx: 0, dy: -1 });
    expect(requestsStart(onBanner, confirm(0))).toBe(false);
    const third = apply(createSelect(3), { type: 'join', device: 0 }, confirm(0));
    expect(requestsStart(third, confirm(2))).toBe(false);
    expect(requestsStart(apply(ready, { type: 'rules', open: true }), confirm(0))).toBe(false);
  });

  it('asks to start when a joined player presses Start, even before picking or on the banner', () => {
    const start = (player: 0 | 1 | 2): SelectAction => ({ type: 'start', player });
    expect(requestsStart(twoPlayers(), start(1))).toBe(true);
    const onBanner = apply(ready, { type: 'move', player: 0, dx: 0, dy: -1 });
    expect(requestsStart(onBanner, start(0))).toBe(true);
    expect(apply(onBanner, start(0))).toEqual(onBanner);
    const third = apply(createSelect(3), { type: 'join', device: 0 });
    expect(requestsStart(third, start(2))).toBe(false);
    expect(requestsStart(apply(ready, { type: 'rules', open: true }), start(0))).toBe(false);
  });

  it('can start once everyone is ready and the rules are closed', () => {
    expect(canStart(ready)).toBe(true);
    expect(canStart(apply(twoPlayers(), confirm(0)))).toBe(false);
    expect(canStart(apply(ready, { type: 'rules', open: true }))).toBe(false);
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

  it('turns a Start press into a start request', () => {
    expect(menuActions(1, NEUTRAL_INPUT, inputOf({ start: true }))).toEqual([
      { type: 'start', player: 1 },
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

describe('player panel preview', () => {
  it('updates before picking, retains the fighter on headers, and locks the confirmed pick', () => {
    const joined = apply(createSelect(4), { type: 'join', device: 0 });
    expect(previewCharacter(joined, 0, ROSTER)?.id).toBe('a');
    const moved = apply(joined, { type: 'move', player: 0, dx: 1, dy: 0 });
    expect(previewCharacter(moved, 0, ROSTER)?.id).toBe('b');
    const header = apply(moved, { type: 'move', player: 0, dx: 0, dy: -1 });
    expect(previewCharacter(header, 0, ROSTER, 'b')?.id).toBe('b');
    const picked = apply(moved, { type: 'confirm', player: 0 });
    const browsingElsewhere = apply(picked, { type: 'move', player: 0, dx: 1, dy: 0 });
    expect(previewCharacter(browsingElsewhere, 0, ROSTER)?.id).toBe('b');
    const unpicked = apply(browsingElsewhere, { type: 'cancel', player: 0 });
    expect(previewCharacter(unpicked, 0, ROSTER)?.id).toBe('c');
    expect(previewCharacter(joined, 1, ROSTER)).toBeUndefined();
  });
});

describe('lobbyStands', () => {
  it('puts each joined player on their platform with the fighter they show, ready once picked', () => {
    const state = apply(
      createSelect(4),
      { type: 'join', device: 0 },
      { type: 'join', device: 1 },
      { type: 'move', player: 1, dx: 1, dy: 0 },
      { type: 'confirm', player: 0 },
    );
    expect(lobbyStands(state, ROSTER, new Map())).toEqual([
      { characterId: 'a', ready: true },
      { characterId: 'b', ready: false },
      { characterId: null, ready: false },
      { characterId: null, ready: false },
    ]);
  });

  it('keeps showing the fighter a device last browsed while its player sits on a header', () => {
    const state = apply(
      createSelect(4),
      { type: 'join', device: 3 },
      { type: 'move', player: 0, dx: 0, dy: -1 },
    );
    expect(lobbyStands(state, ROSTER, new Map([[3, 'c']]))[0]).toEqual({
      characterId: 'c',
      ready: false,
    });
  });
});
