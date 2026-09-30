import type { MatchRules, MatchState } from '../core';
import type { App } from './app';
import type { SelectState } from './character-select';
import type { Screen } from './screens';

/**
 * A small window handle for automated tests and AI agents (via the Playwright MCP)
 * to read game state without scraping pixels. Read-mostly on purpose.
 */
export interface DebugHandle {
  /** The screen the app shows right now. */
  screen(): Screen;
  /** The running match, the last finished one on the results screen, otherwise undefined. */
  state(): MatchState | undefined;
  /** Each player's cursor and pick while character select is open, otherwise undefined. */
  characterSelect(): SelectState | undefined;
  /** The rules the next match will use, as set on the options screen. */
  rules(): MatchRules;
  restart(): void;
}

declare global {
  interface Window {
    __SSB__?: DebugHandle;
  }
}

export const installDebugHandle = (app: App): void => {
  window.__SSB__ = {
    screen: () => app.currentScreen,
    state: () => app.matchState(),
    characterSelect: () => app.selectState,
    rules: () => app.currentRules,
    restart: () => app.restartMatch(),
  };
};
