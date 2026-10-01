import { inputOf, type MatchRules, type MatchState, type PlayerInput } from '../core';
import type { App } from './app';
import type { SelectState } from './character-select';
import type { OverridableInput } from './debug-input';
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
  /** Takes over a player (0 = P1): reports `input` instead of their keys until `release`. */
  hold(player: number, input: Partial<PlayerInput>): void;
  release(player: number): void;
}

declare global {
  interface Window {
    __SSB__?: DebugHandle;
  }
}

export const installDebugHandle = (app: App, inputs: readonly OverridableInput[]): void => {
  window.__SSB__ = {
    screen: () => app.currentScreen,
    state: () => app.matchState(),
    characterSelect: () => app.selectState,
    rules: () => app.currentRules,
    restart: () => app.restartMatch(),
    hold: (player, input) => inputs[player]?.override(inputOf(input)),
    release: (player) => inputs[player]?.override(null),
  };
};
