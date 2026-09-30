/**
 * Character select as plain data and pure functions: each player moves a cursor over the
 * grid, picks with attack and un-picks with special. The screen (character-select-view.ts)
 * only draws this state and feeds it actions.
 */
import { pressed, type CharacterDef, type PlayerInput, type PlayerSlot } from '../core';

export interface SelectState {
  /** Grid index under each player's cursor. */
  readonly cursors: readonly number[];
  /** Picked character id per player, or null while still choosing. */
  readonly picks: readonly (string | null)[];
}

export type SelectAction =
  | { readonly type: 'move'; readonly player: PlayerSlot; readonly dx: number; readonly dy: number }
  | { readonly type: 'confirm'; readonly player: PlayerSlot }
  | { readonly type: 'cancel'; readonly player: PlayerSlot };

/** How far the stick must be pushed to count as a menu move. */
const STICK_THRESHOLD = 0.5;

export const createSelect = (playerCount: number): SelectState => ({
  cursors: Array.from({ length: playerCount }, () => 0),
  picks: Array.from({ length: playerCount }, () => null),
});

export const allReady = (state: SelectState): boolean =>
  state.picks.length > 0 && state.picks.every((pick) => pick !== null);

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

/** Left/right walks the roster in order; up/down jumps a row, staying in the column. */
const moveCursor = (index: number, dx: number, dy: number, count: number, columns: number) => {
  if (dx !== 0) return wrap(index + dx, count);
  const rows = Math.ceil(count / columns);
  const row = wrap(Math.floor(index / columns) + dy, rows);
  return Math.min(row * columns + (index % columns), count - 1);
};

const replace = <T>(list: readonly T[], at: number, value: T): T[] =>
  list.map((item, i) => (i === at ? value : item));

export const reduceSelect = (
  state: SelectState,
  action: SelectAction,
  roster: readonly CharacterDef[],
  columns: number,
): SelectState => {
  const { player } = action;
  const picked = state.picks[player] ?? null;
  const cursor = state.cursors[player] ?? 0;
  switch (action.type) {
    case 'move':
      if (picked !== null || roster.length === 0) return state;
      return {
        ...state,
        cursors: replace(
          state.cursors,
          player,
          moveCursor(cursor, action.dx, action.dy, roster.length, columns),
        ),
      };
    case 'confirm': {
      const character = roster[cursor];
      if (picked !== null || !character) return state;
      return { ...state, picks: replace(state.picks, player, character.id) };
    }
    case 'cancel':
      if (picked === null) return state;
      return { ...state, picks: replace(state.picks, player, null) };
  }
};

const direction = (value: number): number =>
  value > STICK_THRESHOLD ? 1 : value < -STICK_THRESHOLD ? -1 : 0;

/**
 * The one grid step a stick position means: a diagonal counts along its stronger axis only.
 * Stick up is +y, but the grid's row index grows downwards.
 */
const menuDirection = (input: PlayerInput): { dx: number; dy: number } =>
  Math.abs(input.x) >= Math.abs(input.y)
    ? { dx: direction(input.x), dy: 0 }
    : { dx: 0, dy: -direction(input.y) };

/** The menu actions one player's controller produced this frame (presses only, not holds). */
export const menuActions = (
  player: PlayerSlot,
  previous: PlayerInput,
  current: PlayerInput,
): SelectAction[] => {
  const actions: SelectAction[] = [];
  // A move fires whenever the effective direction changes, so rolling from one key or stick
  // direction to another moves again without passing through neutral.
  const now = menuDirection(current);
  const before = menuDirection(previous);
  const moving = now.dx !== 0 || now.dy !== 0;
  if (moving && (now.dx !== before.dx || now.dy !== before.dy)) {
    actions.push({ type: 'move', player, ...now });
  }
  if (pressed(current, previous, 'attack')) actions.push({ type: 'confirm', player });
  if (pressed(current, previous, 'special')) actions.push({ type: 'cancel', player });
  return actions;
};
