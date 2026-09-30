import type { MatchState } from '../core';
import type { GameSession } from '../ports';

/**
 * A small window handle for automated tests and AI agents (via the Playwright MCP)
 * to read game state without scraping pixels. Read-mostly on purpose.
 */
export interface DebugHandle {
  state(): MatchState;
  restart(): void;
}

declare global {
  interface Window {
    __SSB__?: DebugHandle;
  }
}

export const installDebugHandle = (deps: {
  session: () => GameSession;
  restart: () => void;
}): void => {
  window.__SSB__ = {
    state: () => deps.session().view().current,
    restart: deps.restart,
  };
};
