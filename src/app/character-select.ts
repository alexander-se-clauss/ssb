/**
 * Character select as plain data and pure functions: a device joins the first free player slot by
 * pressing attack, then that player moves a cursor over the grid, picks with attack and un-picks
 * with special; special without a pick leaves the slot, and later players move up so slots have no
 * gaps. Before joining, devices navigate only rules and Back; down clears header focus so
 * attack can join. Confirming a header action opens rules or leaves the screen. The screen (character-select-view.ts) only draws this state and feeds it actions.
 */
import type { CharacterDef, PlayerInput, PlayerSlot } from '../core';
import type { PlatformStand } from '../adapters/three-renderer/lobby-scene';
import { menuCommands, type MenuCommand } from './menu-commands';

/** Cursor position of a player who is on the rules banner instead of the grid. */
export const RULES_CURSOR = -1;
/** The Back button sits to the left of the rules banner. */
export const BACK_CURSOR = -2;

export interface SelectState {
  /** Which input device (index in the app's device list) has joined each slot, or null. */
  readonly devices: readonly (number | null)[];
  /** Grid index under each player's cursor, or a header button's cursor. */
  readonly cursors: readonly number[];
  /** Devices can browse the screen before registering a player slot. */
  readonly guestCursors: Readonly<Record<number, number>>;
  /** Last device to act, used to synchronize visible header focus with keyboard Enter. */
  readonly activeDevice: number | null;
  /** Picked character id per player, or null while still choosing. */
  readonly picks: readonly (string | null)[];
  /** The rules overlay is open; players' grid controls pause meanwhile. */
  readonly rulesOpen: boolean;
  /** Players needed to start: two for versus, one for training (#144). */
  readonly minPlayers: number;
}

export type SelectAction =
  | { readonly type: 'move'; readonly player: PlayerSlot; readonly dx: number; readonly dy: number }
  | { readonly type: 'confirm'; readonly player: PlayerSlot }
  | { readonly type: 'cancel'; readonly player: PlayerSlot }
  /** Start: starts the match if everyone is ready, like Enter. Changes nothing itself. */
  | { readonly type: 'start'; readonly player: PlayerSlot }
  /** A device not playing yet pressed attack: it takes the first free slot. */
  | { readonly type: 'join'; readonly device: number }
  | {
      readonly type: 'guest-move';
      readonly device: number;
      readonly dx: number;
      readonly dy: number;
    }
  | { readonly type: 'guest-confirm'; readonly device: number }
  /** Opens or closes the rules overlay, e.g. by mouse or from the overlay itself. */
  | { readonly type: 'rules'; readonly open: boolean };

/** A versus match needs at least this many players. */
export const MIN_PLAYERS = 2;

/** An empty character select with `slots` player slots, nobody joined yet. */
export const createSelect = (slots: number, minPlayers = MIN_PLAYERS): SelectState => ({
  devices: Array.from({ length: slots }, () => null),
  cursors: Array.from({ length: slots }, () => 0),
  guestCursors: {},
  activeDevice: null,
  picks: Array.from({ length: slots }, () => null),
  rulesOpen: false,
  minPlayers,
});

/** The slot a device plays in, or -1 if it has not joined. */
export const slotOf = (state: SelectState, device: number): PlayerSlot =>
  state.devices.indexOf(device);

/** At least `minPlayers` joined, and every joined player has picked. */
export const allReady = (state: SelectState): boolean =>
  state.devices.filter((device) => device !== null).length >= state.minPlayers &&
  state.devices.every((device, slot) => device === null || state.picks[slot] != null);

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

/**
 * Left/right walks the roster in order; up/down jumps a row, staying in the column. Up from the
 * top row reaches rules; left from rules reaches Back. Down from either returns to the roster.
 */
const moveCursor = (index: number, dx: number, dy: number, count: number, columns: number) => {
  if (index === BACK_CURSOR) return dy > 0 ? 0 : dx > 0 ? RULES_CURSOR : BACK_CURSOR;
  if (index === RULES_CURSOR) return dy > 0 ? 0 : dx < 0 ? BACK_CURSOR : RULES_CURSOR;
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
  if (action.type === 'guest-move') {
    if (state.devices.includes(action.device) || roster.length === 0) return state;
    const cursor = state.guestCursors[action.device] ?? RULES_CURSOR;
    const guestCursors = Object.fromEntries(
      Object.entries(state.guestCursors).filter(([device]) => Number(device) !== action.device),
    );
    if (action.dy <= 0) {
      guestCursors[action.device] =
        action.dx < 0 ? BACK_CURSOR : action.dx > 0 ? RULES_CURSOR : cursor;
    }
    return {
      ...state,
      activeDevice: action.device,
      guestCursors,
    };
  }
  if (action.type === 'join' || action.type === 'guest-confirm') {
    const cursor = state.guestCursors[action.device] ?? 0;
    if (action.type === 'guest-confirm') {
      if (state.devices.includes(action.device)) return state;
      if (cursor === RULES_CURSOR)
        return { ...state, activeDevice: action.device, rulesOpen: true };
      if (cursor === BACK_CURSOR) return state;
    }
    const slot = state.devices.indexOf(null);
    if (slot < 0 || state.devices.includes(action.device)) return state;
    const guestCursors = Object.fromEntries(
      Object.entries(state.guestCursors).filter(([device]) => Number(device) !== action.device),
    );
    return {
      ...state,
      guestCursors,
      activeDevice: action.device,
      devices: replace(state.devices, slot, action.device),
      cursors: replace(state.cursors, slot, Math.max(0, cursor)),
      picks: replace(state.picks, slot, null),
    };
  }
  const { player } = action;
  if (state.devices[player] == null) return state;
  const picked = state.picks[player] ?? null;
  const cursor = state.cursors[player] ?? 0;
  switch (action.type) {
    case 'start':
      return state;
    // As in Melee, a player can move on after picking; the pick stays until cancelled.
    case 'move':
      if (roster.length === 0) return state;
      return {
        ...state,
        activeDevice: state.devices[player] ?? null,
        cursors: replace(
          state.cursors,
          player,
          moveCursor(cursor, action.dx, action.dy, roster.length, columns),
        ),
      };
    case 'confirm': {
      if (cursor === RULES_CURSOR)
        return { ...state, activeDevice: state.devices[player] ?? null, rulesOpen: true };
      const character = roster[cursor];
      if (picked !== null || !character) return state;
      return {
        ...state,
        activeDevice: state.devices[player] ?? null,
        picks: replace(state.picks, player, character.id),
      };
    }
    case 'cancel':
      if (picked === null) return leave(state, player);
      return {
        ...state,
        activeDevice: state.devices[player] ?? null,
        picks: replace(state.picks, player, null),
      };
  }
};

/**
 * Whether an action asks to start the match: a joined player presses Start, or confirms again
 * after picking, like Enter. It depends only on that player, so the screen can judge every
 * request after all of a frame's actions (`canStart`).
 */
export const requestsStart = (state: SelectState, action: SelectAction): boolean => {
  if (action.type !== 'start' && action.type !== 'confirm') return false;
  const { player } = action;
  if (state.rulesOpen || state.devices[player] == null) return false;
  return (
    action.type === 'start' || (state.picks[player] != null && (state.cursors[player] ?? 0) >= 0)
  );
};

/** Confirming Back leaves the screen, independently of whether this device has joined. */
export const requestsBack = (state: SelectState, action: SelectAction): boolean => {
  if (state.rulesOpen) return false;
  if (action.type === 'guest-confirm') return state.guestCursors[action.device] === BACK_CURSOR;
  return (
    action.type === 'confirm' &&
    state.devices[action.player] != null &&
    state.cursors[action.player] === BACK_CURSOR
  );
};

/** Whether the match may start now: everyone is ready and the rules overlay is closed. */
export const canStart = (state: SelectState): boolean => !state.rulesOpen && allReady(state);

/** Grid steps per stick direction; rows grow downwards. */
const STEPS: Readonly<
  Record<Exclude<MenuCommand, 'confirm' | 'back' | 'start'>, readonly [number, number]>
> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** The menu actions one player's controller produced this frame (presses only, not holds). */
export const menuActions = (
  player: PlayerSlot,
  previous: PlayerInput,
  current: PlayerInput,
): SelectAction[] =>
  menuCommands(previous, current).map((command): SelectAction => {
    if (command === 'confirm') return { type: 'confirm', player };
    if (command === 'back') return { type: 'cancel', player };
    if (command === 'start') return { type: 'start', player };
    const [dx, dy] = STEPS[command];
    return { type: 'move', player, dx, dy };
  });

/** Confirmed picks remain locked; otherwise preview the hovered fighter, retaining it on headers. */
export const previewCharacter = (
  state: SelectState,
  player: number,
  roster: readonly CharacterDef[],
  lastHovered?: string,
): CharacterDef | undefined => {
  if (state.devices[player] == null) return undefined;
  const pick = state.picks[player];
  if (pick != null) return roster.find((character) => character.id === pick);
  return (
    roster[state.cursors[player] ?? 0] ??
    roster.find((character) => character.id === lastHovered) ??
    roster[0]
  );
};

/** What stands on a player's platform: their fighter, or nothing while the slot is open. */
export type LobbyStand = PlatformStand;

/**
 * One stand per player slot. `browsing` remembers, per device, the fighter it showed last, so a
 * player on the header keeps their fighter on the platform.
 */
export const lobbyStands = (
  state: SelectState,
  roster: readonly CharacterDef[],
  browsing: ReadonlyMap<number, string>,
): LobbyStand[] =>
  state.picks.map((pick, player) => {
    const device = state.devices[player];
    const shown = previewCharacter(
      state,
      player,
      roster,
      device != null ? browsing.get(device) : undefined,
    );
    return { characterId: shown?.id ?? null, ready: pick != null };
  });
