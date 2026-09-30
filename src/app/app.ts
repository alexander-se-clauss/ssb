import {
  CHARACTERS,
  STAGES,
  DEFAULT_RULES,
  NEUTRAL_INPUT,
  type PlayerInput,
  type MatchConfig,
  type MatchRules,
  type MatchState,
  type StageDef,
} from '../core';
import type { GameSession, GameView, InputSource, Unsubscribe } from '../ports';
import {
  allReady,
  createSelect,
  menuActions,
  reduceSelect,
  type SelectState,
} from './character-select';
import { CharacterSelectView } from './character-select-view';
import { MenuPanel, type MenuContent } from './menu-panel';
import { renderResults, resultHeading } from './results';
import { renderPreview } from './stage-preview';
import { adjustRule, optionRows, type RuleField } from './options';
import { INITIAL_SCREEN, MAIN_MENU, go, nextScreens, type Screen } from './screens';

/** Characters per row on the character select grid. */
const GRID_COLUMNS = 4;

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
  /** Chosen on the options screen; used by every following match. */
  private rules: MatchRules = DEFAULT_RULES;
  /** Character select progress while that screen is open. */
  private select: SelectState | undefined;
  /** Chosen on stage select; the first stage until then. */
  private stageId: string = STAGES[0]?.id ?? '';
  /** Each player's pick from the last completed character select. */
  private picks: readonly string[] = [];
  /** Last frame's input per player, for press detection in menus. */
  private previousInputs: PlayerInput[] = [];
  private readonly menu: MenuPanel;
  private readonly characterSelect: CharacterSelectView;

  constructor(
    private readonly container: HTMLElement,
    private readonly adapters: AppAdapters,
  ) {
    this.menu = new MenuPanel(container);
    this.characterSelect = new CharacterSelectView(container, CHARACTERS, GRID_COLUMNS, {
      start: () => this.confirmCharacters(),
      back: () => this.navigate('main-menu'),
    });
    this.enter(this.screen);
  }

  get currentScreen(): Screen {
    return this.screen;
  }

  /** Character select progress, while that screen is open. */
  get selectState(): SelectState | undefined {
    return this.select;
  }

  /** The rules the next match will use. */
  get currentRules(): MatchRules {
    return this.rules;
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
    if (this.screen === 'character-select') this.updateCharacterSelect();
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
    if (screen === 'character-select') {
      this.select = createSelect(this.adapters.inputs.length);
      // Start press detection from the current state, so a held button doesn't pick at once.
      this.previousInputs = this.adapters.inputs.map((source) => source.sample());
      this.characterSelect.render(this.select, false);
      return;
    }
    const focus = screen === 'stage-select' ? STAGES.findIndex((s) => s.id === this.stageId) : 0;
    this.menu.show(this.menuFor(screen), Math.max(focus, 0));
  }

  private chooseStage(stageId: string): void {
    this.stageId = stageId;
    this.navigate('match');
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
      case 'options':
        return {
          heading: 'Options',
          text: '←/→ to change · Esc to go back',
          options: [
            ...optionRows(this.rules).map((row, index) => ({
              label: row.label,
              select: () => this.changeRule(row.field, 1, index),
              adjust: (delta: 1 | -1) => this.changeRule(row.field, delta, index),
            })),
            { label: 'Back', select: () => this.navigate('main-menu') },
          ],
          back: () => this.navigate('main-menu'),
        };
      case 'stage-select':
        return {
          heading: 'Choose a stage',
          text: 'Enter to pick · Esc to go back',
          options: [
            ...STAGES.map((stage) => ({
              label: stage.name,
              select: () => this.chooseStage(stage.id),
            })),
            { label: 'Back', select: () => this.navigate('character-select') },
          ],
          back: () => this.navigate('character-select'),
          preview: (index) => {
            const stage = STAGES[index];
            return stage ? renderPreview(stage) : null;
          },
        };
      case 'results':
        return {
          heading: this.lastResult ? resultHeading(this.lastResult) : 'Results',
          ...(this.lastResult ? { body: renderResults(this.lastResult) } : {}),
          options: [
            { label: 'Rematch', select: () => this.navigate('match') },
            { label: 'Main menu', select: () => this.navigate('main-menu') },
          ],
          back: () => this.navigate('main-menu'),
        };
      default:
        // The match has no menu; this only keeps the switch exhaustive.
        return {
          heading: LABELS[screen],
          options: nextScreens(screen).map((to) => ({
            label: LABELS[to],
            select: () => this.navigate(to),
          })),
        };
    }
  }

  private leave(screen: Screen): void {
    if (screen === 'match') this.stopMatch();
    else if (screen === 'character-select') this.leaveCharacterSelect();
    else this.menu.hide();
  }

  private updateCharacterSelect(): void {
    let state = this.select;
    if (!state) return;
    this.adapters.inputs.forEach((source, player) => {
      const current = source.sample();
      const previous = this.previousInputs[player] ?? NEUTRAL_INPUT;
      for (const action of menuActions(player, previous, current)) {
        if (state) state = reduceSelect(state, action, CHARACTERS, GRID_COLUMNS);
      }
      this.previousInputs[player] = current;
    });
    this.select = state;
    this.characterSelect.render(state, allReady(state));
  }

  /** Enter on character select: only here do the picks become the next match's fighters. */
  private confirmCharacters(): void {
    const picks = this.select?.picks ?? [];
    const complete = picks.filter((pick): pick is string => pick !== null);
    if (complete.length === 0 || complete.length !== picks.length) return;
    this.picks = complete;
    this.navigate('stage-select');
  }

  private leaveCharacterSelect(): void {
    this.select = undefined;
    this.characterSelect.hide();
  }

  private changeRule(field: RuleField, delta: 1 | -1, row: number): void {
    this.rules = adjustRule(this.rules, field, delta);
    this.menu.show(this.menuFor('options'), row);
  }

  private startMatch(): void {
    if (this.picks.length !== this.adapters.inputs.length) {
      throw new Error('A match needs a character pick for every player');
    }
    const players = this.picks.map((characterId) => ({ characterId }));
    const session = this.adapters.createSession({
      stageId: this.stageId,
      players,
      rules: this.rules,
    });
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
