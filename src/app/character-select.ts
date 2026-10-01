/**
 * Character select as plain data and pure functions: a device joins the first free player slot by
 * pressing attack, then that player moves a cursor over the grid, picks with attack and un-picks
 * with special; special without a pick leaves the slot, and later players move up so slots have no
 * gaps. Above the grid sits the rules banner, as in Melee: moving up onto it and picking opens the
 * rules. The screen (character-select-view.ts) only draws this state and feeds it actions.
 */
import type { CharacterDef, PlayerInput, PlayerSlot } from '../core';
import { menuCommands, type MenuCommand } from './menu-commands';

/** Cursor position of a player who is on the rules banner instead of the grid. */
export const RULES_CURSOR = -1;

export interface SelectState {
  /** Which input device (index in the app's device list) has joined each slot, or null. */
  readonly devices: readonly (number | null)[];
  /** Grid index under each player's cursor, or `RULES_CURSOR`. */
  readonly cursors: readonly number[];
  /** Picked character id per player, or null while still choosing. */
  readonly picks: readonly (string | null)[];
  /** The rules overlay is open; players' grid controls pause meanwhile. */
  readonly rulesOpen: boolean;
}

export type SelectAction =
  | { readonly type: 'move'; readonly player: PlayerSlot; readonly dx: number; readonly dy: number }
  | { readonly type: 'confirm'; readonly player: PlayerSlot }
  | { readonly type: 'cancel'; readonly player: PlayerSlot }
  /** A device not playing yet pressed attack: it takes the first free slot. */
  | { readonly type: 'join'; readonly device: number }
  /** Opens or closes the rules overlay, e.g. by mouse or from the overlay itself. */
  | { readonly type: 'rules'; readonly open: boolean };

/** An empty character select with `slots` player slots, nobody joined yet. */
export const createSelect = (slots: number): SelectState => ({
  devices: Array.from({ length: slots }, () => null),
  cursors: Array.from({ length: slots }, () => 0),
  picks: Array.from({ length: slots }, () => null),
  rulesOpen: false,
});

/** The slot a device plays in, or -1 if it has not joined. */
export const slotOf = (state: SelectState, device: number): PlayerSlot =>
  state.devices.indexOf(device);

/** A versus match needs at least this many players. */
export const MIN_PLAYERS = 2;

/** At least `MIN_PLAYERS` joined, and every joined player has picked. */
export const allReady = (state: SelectState): boolean =>
  state.devices.filter((device) => device !== null).length >= MIN_PLAYERS &&
  state.devices.every((device, slot) => device === null || state.picks[slot] != null);

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

/**
 * Left/right walks the roster in order; up/down jumps a row, staying in the column. Up from the
 * top row reaches the rules banner, and down from the banner returns to the first fighter.
 */
const moveCursor = (index: number, dx: number, dy: number, count: number, columns: number) => {
  if (index === RULES_CURSOR) return dy > 0 ? 0 : RULES_CURSOR;
  if (dy < 0 && index < columns) return RULES_CURSOR;
  if (dx !== 0) return wrap(index + dx, count);
  const rows = Math.ceil(count / columns);
  const row = wrap(Math.floor(index / columns) + dy, rows);
  return Math.min(row * columns + (index % columns), count - 1);
};

const replace = <T>(list: readonly T[], at: number, value: T): T[] =>
  list.map((item, i) => (i === at ? value : item));

/** Removes a player; everyone after moves up a slot, so player numbers stay 1, 2, 3 in a row. */
const leave = (state: SelectState, player: PlayerSlot): SelectState => {
  const without = <T>(list: readonly T[], empty: T): T[] => [
    ...list.filter((_, slot) => slot !== player),
    empty,
  ];
  return {
    ...state,
    devices: without(state.devices, null),
    cursors: without(state.cursors, 0),
    picks: without(state.picks, null),
  };
};

export const reduceSelect = (
  state: SelectState,
  action: SelectAction,
  roster: readonly CharacterDef[],
  columns: number,
): SelectState => {
  if (action.type === 'rules') return { ...state, rulesOpen: action.open };
  // While the rules are open, special closes them and everything else waits.
  if (state.rulesOpen) return action.type === 'cancel' ? { ...state, rulesOpen: false } : state;
  if (action.type === 'join') {
    const slot = state.devices.indexOf(null);
    if (slot < 0 || state.devices.includes(action.device)) return state;
    return {
      ...state,
      devices: replace(state.devices, slot, action.device),
      cursors: replace(state.cursors, slot, 0),
      picks: replace(state.picks, slot, null),
    };
  }
  const { player } = action;
  if (state.devices[player] == null) return state;
  const picked = state.picks[player] ?? null;
  const cursor = state.cursors[player] ?? 0;
  switch (action.type) {
    // As in Melee, a player can move on after picking; the pick stays until cancelled.
    case 'move':
      if (roster.length === 0) return state;
      return {
        ...state,
        cursors: replace(
          state.cursors,
          player,
          moveCursor(cursor, action.dx, action.dy, roster.length, columns),
        ),
      };
    case 'confirm': {
      if (cursor === RULES_CURSOR) return { ...state, rulesOpen: true };
      const character = roster[cursor];
      if (picked !== null || !character) return state;
      return { ...state, picks: replace(state.picks, player, character.id) };
    }
    case 'cancel':
      if (picked === null) return leave(state, player);
      return { ...state, picks: replace(state.picks, player, null) };
  }
};

/**
 * Whether an action starts the match, judged on the state before it: a joined player confirming
 * once everyone has picked, like Enter. This lets a gamepad, which has no Enter, get through.
 */
export const selectOutcome = (state: SelectState, action: SelectAction): 'start' | null => {
  if (state.rulesOpen || action.type !== 'confirm') return null;
  const joined = state.devices[action.player] != null;
  const onBanner = state.cursors[action.player] === RULES_CURSOR;
  return joined && allReady(state) && !onBanner ? 'start' : null;
};

/** Grid steps per stick direction; rows grow downwards. */
const STEPS: Readonly<Record<Exclude<MenuCommand, 'confirm' | 'back'>, readonly [number, number]>> =
  { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** The menu actions one player's controller produced this frame (presses only, not holds). */
export const menuActions = (
  player: PlayerSlot,
  previous: PlayerInput,
  current: PlayerInput,
): SelectAction[] =>
  menuCommands(previous, current).map((command): SelectAction => {
    if (command === 'confirm') return { type: 'confirm', player };
    if (command === 'back') return { type: 'cancel', player };
    const [dx, dy] = STEPS[command];
    return { type: 'move', player, dx, dy };
  });
