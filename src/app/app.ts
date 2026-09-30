import type { MatchConfig, MatchState, StageDef } from '../core';
import type { GameSession, GameView, InputSource, Unsubscribe } from '../ports';
import { MenuPanel, type MenuContent } from './menu-panel';
import { INITIAL_SCREEN, MAIN_MENU, go, nextScreens, type Screen } from './screens';

/** Working title, shown on the title screen. */
const GAME_NAME = 'SSB';

/** How long the winner banner stays up before the results screen. */
const RESULTS_DELAY_MS = 1500;

const LABELS: Readonly<Record<Screen, string>> = {
  title: 'Title',
  'main-menu': 'Main menu',
  options: 'Options',
  'character-select': 'Character select',
  'stage-select': 'Stage select',
  match: 'Match',
  results: 'Results',
};

/** How the app gets its adapters. `main.ts` decides which ones; `App` only uses the ports. */
export interface AppAdapters {
  readonly inputs: readonly InputSource[];
  /** Starts a match: locally today, on a server later. */
  readonly createSession: (config: MatchConfig) => GameSession;
  readonly createViews: (container: HTMLElement, stage: StageDef) => readonly GameView[];
}

/** Everything that exists only while a match is running. */
interface RunningMatch {
  readonly session: GameSession;
  readonly views: readonly GameView[];
  readonly unsubscribe: Unsubscribe;
}

/**
 * Owns the current screen. Menu screens are HTML panels; entering `match` creates a session
 * and its views, leaving it disposes them, so each match starts clean.
 */
export class App {
  private screen: Screen = INITIAL_SCREEN;
  private match: RunningMatch | undefined;
  private lastResult: MatchState | undefined;
  private readonly menu: MenuPanel;

  constructor(
    private readonly container: HTMLElement,
    private readonly adapters: AppAdapters,
    /** Fixed for now; the options, character and stage screens will build it. */
    private readonly matchConfig: MatchConfig,
  ) {
    this.menu = new MenuPanel(container);
    this.enter(this.screen);
  }

  get currentScreen(): Screen {
    return this.screen;
  }

  /** State of the running match, or of the last finished one while results are shown. */
  matchState(): MatchState | undefined {
    if (this.screen === 'results') return this.lastResult;
    return this.match?.session.view().current;
  }

  navigate(to: Screen): void {
    const next = go(this.screen, to);
    this.leave(this.screen);
    this.screen = next;
    this.enter(next);
  }

  /** Restarts the running match. Used by the debug handle. */
  restartMatch(): void {
    if (this.screen !== 'match') return;
    this.stopMatch();
    this.startMatch();
  }

  frame(now: number): void {
    if (!this.match) return;
    const { session, views } = this.match;
    session.localSlots.forEach((slot, index) => {
      const source = this.adapters.inputs[index];
      if (source) session.setInput(slot, source.sample());
    });
    session.update(now);
    const view = session.view();
    for (const v of views) v.render(view);
  }

  resize(): void {
    for (const view of this.match?.views ?? []) {
      view.resize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  private enter(screen: Screen): void {
    if (screen === 'match') {
      this.startMatch();
      return;
    }
    this.menu.show(this.menuFor(screen));
  }

  private menuFor(screen: Screen): MenuContent {
    switch (screen) {
      case 'title':
        return {
          heading: GAME_NAME,
          text: 'Press start (Enter or Space)',
          variant: 'menu-title',
          start: () => this.navigate('main-menu'),
        };
      case 'main-menu':
        return {
          heading: 'Main menu',
          text: 'Esc to go back',
          options: MAIN_MENU.map((entry) => ({
            label: entry.label,
            select: () => this.navigate(entry.to),
          })),
          back: () => this.navigate('title'),
        };
      default:
        // Placeholders until their sprint-1 issues replace them.
        return {
          heading: LABELS[screen],
          text: this.describe(screen),
          options: nextScreens(screen).map((to) => ({
            label: LABELS[to],
            select: () => this.navigate(to),
          })),
        };
    }
  }

  private leave(screen: Screen): void {
    if (screen === 'match') this.stopMatch();
    else this.menu.hide();
  }

  private describe(screen: Screen): string {
    if (screen !== 'results' || !this.lastResult) return 'Placeholder screen';
    const winner = this.lastResult.winner;
    return winner === null ? 'Draw' : `Player ${winner + 1} wins`;
  }

  private startMatch(): void {
    const session = this.adapters.createSession(this.matchConfig);
    const views = this.adapters.createViews(this.container, session.view().current.stage);
    // Drop key taps made in the menus, so the match does not start with a stray jump.
    for (const source of this.adapters.inputs) source.sample();
    const unsubscribe = session.onEvent((event) => {
      if (event.type !== 'match-end') return;
      setTimeout(() => {
        if (this.match?.session === session) this.navigate('results');
      }, RESULTS_DELAY_MS);
    });
    this.match = { session, views, unsubscribe };
    this.lastResult = undefined;
    this.resize();
  }

  private stopMatch(): void {
    if (!this.match) return;
    this.lastResult = this.match.session.view().current;
    this.match.unsubscribe();
    this.match.session.dispose();
    for (const view of this.match.views) view.dispose();
    this.match = undefined;
  }
}
