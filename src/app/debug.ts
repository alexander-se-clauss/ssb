import { inputOf, type MatchRules, type MatchState, type PlayerInput } from '../core';
import type { App } from './app';
import type { SelectState } from './character-select';
import type { Screen } from './screens';

/**
 * A small window handle for automated tests and AI agents (via the Playwright MCP)
 * to read game state without scraping pixels. Read-mostly on purpose: the only way to change
 * the game is to play it, by taking over a player's input.
 */
export interface DebugHandle {
  /** The screen the app shows right now. */
  screen(): Screen;
  /** The running match, the last finished one on the results screen, otherwise undefined. */
  state(): MatchState | undefined;
  /** Each player's cursor and pick, and whether the rules are open, during character select. */
  characterSelect(): SelectState | undefined;
  /** The rules the next match will use, as set in the rules overlay on character select. */
  rules(): MatchRules;
  restart(): void;
  /**
   * Takes over a player (0 = P1): their device reports `input` instead of its own until
   * `release`. Only for players who joined on character select.
   */
  hold(player: number, input: Partial<PlayerInput>): void;
  release(player: number): void;
}

declare global {
  interface Window {
    __SSB__?: DebugHandle;
  }
}

/** A player's input that the debug handle can take over; `main.ts` picks the implementation. */
export interface ControllableInput {
  override(input: PlayerInput | null): void;
}

/** `devices` are the app's input devices, in the same order. */
export const installDebugHandle = (app: App, devices: readonly ControllableInput[]): void => {
  const deviceOf = (player: number): ControllableInput | undefined => {
    const device = app.deviceOf(player);
    return device === undefined ? undefined : devices[device];
  };
  window.__SSB__ = {
    screen: () => app.currentScreen,
    state: () => app.matchState(),
    characterSelect: () => app.selectState,
    rules: () => app.currentRules,
    restart: () => app.restartMatch(),
    hold: (player, input) => deviceOf(player)?.override(inputOf(input)),
    release: (player) => deviceOf(player)?.override(null),
  };
};
