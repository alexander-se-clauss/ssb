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
import type {
  AudioChannel,
  AudioOutput,
  GameSession,
  GameView,
  InputSource,
  SoundCue,
  Unsubscribe,
} from '../ports';
import {
  allReady,
  canStart,
  createSelect,
  menuActions,
  reduceSelect,
  requestsStart,
  requestsBack,
  slotOf,
  type SelectState,
} from './character-select';
import { menuCommands } from './menu-commands';
import { screenMusic, selectCue } from './menu-sounds';
import { eventCue, stateCues, type FightCue } from './match-sounds';
import { CharacterSelectView } from './character-select-view';
import { renderControls, type ControlColumn } from './controls';
import { MenuPanel, type MenuContent } from './menu-panel';
import { renderResults, resultHeading, resultPlacements, type Elimination } from './results';
import { ResultsScene } from '../adapters/three-renderer/results-scene';
import { adjustRule, ruleRows, type RuleField } from './rules-menu';
import {
  adjustVolume,
  loadAudioSettings,
  saveAudioSettings,
  volumeLevel,
  type AudioSettings,
  type SettingsStore,
} from './audio-settings';
import { stageThumbnail } from '../adapters/three-renderer/stage-thumbnail';
import { fighterPortrait } from '../adapters/three-renderer/fighter-portrait';
import { TitleScene } from '../adapters/three-renderer/title-scene';
import { titleScreenBody } from './title-screen';
import { ScreenTransition } from './screen-transition';
import { INITIAL_SCREEN, MAIN_MENU, go, nextScreens, type Screen } from './screens';

/** Player slots on character select, as in Melee. */
const MAX_PLAYERS = 4;

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
  sound: 'Sound',
  controls: 'Controls',
  'character-select': 'Character select',
  'stage-select': 'Stage select',
  match: 'Match',
  results: 'Results',
};

/** One controller: a gamepad, or one player's half of the keyboard. */
export interface InputDevice {
  readonly label?: string;
  readonly source: InputSource;
  /**
   * Polled for menu commands (gamepads). False for the keyboard, whose keys reach the menus as
   * DOM events, so they never move twice.
   */
  readonly drivesMenus: boolean;
}

/** How the app gets its adapters. `main.ts` decides which ones; `App` only uses the ports. */
export interface AppAdapters {
  /** Every controller that can join a match on character select. */
  readonly devices: readonly InputDevice[];
  /** Starts a match: locally today, on a server later. */
  readonly createSession: (config: MatchConfig) => GameSession;
  readonly createViews: (container: HTMLElement, stage: StageDef) => readonly GameView[];
  /** Button names per kind of device, for the controls screen. */
  readonly controls: readonly ControlColumn[];
  /** Sound effects and music. */
  readonly audio: AudioOutput;
  /** Where settings such as the volumes are kept between visits. */
  readonly settings: SettingsStore;
}

/** Everything that exists only while a match is running. */
interface RunningMatch {
  readonly session: GameSession;
  readonly views: readonly GameView[];
  readonly unsubscribe: Unsubscribe;
  /** The state fight sounds were last taken from (`stateCues`). */
  heard: MatchState;
}

/**
 * Owns the current screen. Menu screens are HTML panels; entering `match` creates a session
 * and its views, leaving it disposes them, so each match starts clean.
 */
export class App {
  private screen: Screen = INITIAL_SCREEN;
  private match: RunningMatch | undefined;
  private lastResult: MatchState | undefined;
  /** Chosen in the rules overlay on character select; used by every following match. */
  private rules: MatchRules = DEFAULT_RULES;
  /** Character select progress while that screen is open. */
  private select: SelectState | undefined;
  /** Chosen on stage select; the first stage until then. */
  private stageId: string = STAGES[0]?.id ?? '';
  /** Each player's pick from the last completed character select. */
  private picks: readonly string[] = [];
  /** Each player's device (index into `devices`) from the last completed character select. */
  private playerDevices: readonly number[] = [];
  /** Last frame's input per device on character select, for press detection. */
  private previousInputs: PlayerInput[] = [];
  /** Last frame's input per device for menu commands, for press detection. */
  private previousMenuInputs: PlayerInput[] = [];
  private readonly menu: MenuPanel;
  /** The rules overlay on top of character select. */
  private readonly rulesPanel: MenuPanel;
  private rulesShown = false;
  /** The rules being edited in the overlay; they apply only on Done. */
  private rulesDraft: MatchRules = DEFAULT_RULES;
  private readonly characterSelect: CharacterSelectView;
  /** The blade wipe that plays over every screen change. */
  private readonly transition: ScreenTransition;
  private titleScene: TitleScene | undefined;
  private resultsScene: ResultsScene | undefined;
  private eliminations: Elimination[] = [];
  /** The Music and Effects volumes from Options. */
  private audioSettings: AudioSettings;

  constructor(
    private readonly container: HTMLElement,
    private readonly adapters: AppAdapters,
  ) {
    this.audioSettings = loadAudioSettings(adapters.settings);
    this.applyVolume('music');
    this.applyVolume('effects');
    const play = (cue: SoundCue): void => adapters.audio.play(cue);
    this.menu = new MenuPanel(container, play);
    this.rulesPanel = new MenuPanel(container, play);
    this.transition = new ScreenTransition(container);
    this.characterSelect = new CharacterSelectView(container, CHARACTERS, GRID_COLUMNS, {
      portrait: fighterPortrait,
      deviceName: (device) => this.adapters.devices[device]?.label ?? `Input ${device + 1}`,
      start: () => this.confirmCharacters(),
      back: () => this.leaveToMainMenu(),
      openRules: () => {
        this.adapters.audio.play('menu-confirm');
        this.setRulesOpen(true);
      },
    });
    document.addEventListener('fullscreenchange', () => {
      if (this.screen === 'options') this.menu.show(this.menuFor('options'), 0);
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

  /**
   * The device (index into `devices`) a player uses: during character select the one that
   * joined that slot, otherwise the one from the last character select.
   */
  deviceOf(player: number): number | undefined {
    const device = this.select ? this.select.devices[player] : this.playerDevices[player];
    return device ?? undefined;
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
    this.transition.play(() => this.renderScenes());
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
    const rulesWereOpen = this.rulesShown;
    this.updateMenus();
    this.titleScene?.render(now);
    // A gamepad press that just closed the rules overlay (Done) must not also reach the grid
    // below, where it would open the rules again from the banner.
    const rulesJustClosed = rulesWereOpen && !this.rulesShown;
    if (this.screen === 'character-select') this.updateCharacterSelect(rulesJustClosed);
    if (!this.match) return;
    const { session, views } = this.match;
    session.localSlots.forEach((slot, index) => {
      const source = this.playerSource(index);
      if (source) session.setInput(slot, source.sample());
    });
    session.update(now);
    const view = session.view();
    for (const v of views) v.render(view);
    for (const cue of stateCues(this.match.heard, view.current)) this.playFight(cue);
    this.match.heard = view.current;
  }

  /**
   * Draws the 3D scenes once more, so the transition's snapshot (taken in the same task) holds
   * their image: a WebGL canvas can only be read right after it was drawn.
   */
  private renderScenes(): void {
    this.titleScene?.render(performance.now());
    this.resultsScene?.render();
    if (this.match) for (const view of this.match.views) view.render(this.match.session.view());
  }

  resize(): void {
    this.transition.resize();
    this.resultsScene?.resize();
    this.titleScene?.resize(this.container.clientWidth, this.container.clientHeight);
    for (const view of this.match?.views ?? []) {
      view.resize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  private enter(screen: Screen): void {
    // Lets the CSS apply screen-specific presentation.
    this.container.dataset['screen'] = screen;
    this.adapters.audio.playMusic(screenMusic(screen, this.stageId));
    if (screen === 'title') this.titleScene = new TitleScene(this.container);
    if (screen === 'match') {
      this.startMatch();
      return;
    }
    if (screen === 'character-select') {
      this.select = createSelect(MAX_PLAYERS);
      // Start press detection from the current state, so a held button doesn't join at once.
      this.previousInputs = this.adapters.devices.map((device) => device.source.sample());
      this.characterSelect.render(this.select, false, this.rules);
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
          text: 'Fight for the edge.',
          variant: 'menu-title',
          body: titleScreenBody(() => {
            this.adapters.audio.play('menu-confirm');
            this.navigate('main-menu');
          }),
          start: () => this.navigate('main-menu'),
        };
      case 'main-menu':
        return {
          heading: 'Main menu',
          variant: 'menu-main',
          options: MAIN_MENU.map((entry) => ({
            label: entry.label,
            artwork: entry.to === 'character-select' ? ('versus' as const) : ('settings' as const),
            select: () => this.navigate(entry.to),
          })),
          back: () => this.navigate('title'),
        };
      case 'options':
        return {
          heading: 'Options',
          variant: 'menu-settings',
          options: [
            {
              label: `Screen: ${document.fullscreenElement ? 'Fullscreen' : 'Window'}`,
              artwork: 'display',
              select: () => this.toggleFullscreen(),
            },
            {
              label: 'Sound',
              artwork: 'sound',
              select: () => this.navigate('sound'),
            },
            {
              label: 'Controls',
              artwork: 'controls',
              select: () => this.navigate('controls'),
            },
          ],
          back: () => this.navigate('main-menu'),
        };
      case 'sound':
        return {
          heading: 'Sound',
          variant: 'menu-list',
          options: (['music', 'effects'] as const).map((channel, index) => ({
            label: `${channel === 'music' ? 'Music' : 'Effects'}: ${this.audioSettings[channel]}`,
            // Picking does nothing; the volume changes with Left/Right or − and +.
            select: () => undefined,
            adjust: (delta: 1 | -1) => this.changeVolume(channel, delta, index),
            cue: null,
          })),
          back: () => this.navigate('options'),
        };
      case 'controls':
        return {
          heading: 'Controls',
          variant: 'menu-controls',
          body: renderControls(this.adapters.controls),
          back: () => this.navigate('options'),
        };
      case 'stage-select':
        return {
          heading: 'Choose a stage',
          variant: 'menu-stage-select',
          grid: true,
          options: STAGES.map((stage) => ({
            label: stage.name,
            image: stageThumbnail(stage),
            select: () => this.chooseStage(stage.id),
            cue: 'match-start' as const,
          })),
          back: () => this.navigate('character-select'),
        };
      case 'results': {
        const placements = this.lastResult
          ? resultPlacements(this.lastResult, this.eliminations)
          : [];
        const body = renderResults(placements);
        const host = body.querySelector<HTMLElement>('.results-scene');
        if (host) this.resultsScene = new ResultsScene(host, placements);
        return {
          heading: this.lastResult ? resultHeading(this.lastResult) : 'Results',
          variant: 'menu-results',
          body,
          options: [
            {
              label: 'Rematch',
              artwork: 'rematch',
              select: () => this.navigate('match'),
              cue: 'match-start',
            },
            { label: 'Main menu', artwork: 'home', select: () => this.navigate('main-menu') },
          ],
          back: () => this.navigate('main-menu'),
          backButton: false,
        };
      }
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
    if (screen === 'results') {
      this.resultsScene?.dispose();
      this.resultsScene = undefined;
    }
    if (screen === 'title') {
      this.titleScene?.dispose();
      this.titleScene = undefined;
    }
    if (screen === 'match') this.stopMatch();
    else if (screen === 'character-select') this.leaveCharacterSelect();
    else this.menu.hide();
  }

  /**
   * Gamepads move the focus on menu screens and in the rules overlay. Character select reads
   * every device itself (`updateCharacterSelect`), so here gamepads only drive its rules overlay.
   */
  private updateMenus(): void {
    const screen = this.screen;
    const rulesShown = this.rulesShown;
    this.adapters.devices.forEach(({ source, drivesMenus }, index) => {
      if (!drivesMenus) return;
      const current = source.sample();
      // Sampled on every screen, so a button held from the last screen is not a new press.
      const previous = this.previousMenuInputs[index] ?? current;
      this.previousMenuInputs[index] = current;
      for (const command of menuCommands(previous, current)) {
        // Once a command changed the screen or closed the overlay, the rest of this frame's
        // presses were meant for the old one: two pads pressing A on the title must not also
        // pick VS. Mode.
        if (this.screen !== screen || this.rulesShown !== rulesShown) return;
        if (this.screen === 'character-select') {
          // A player's B already closes the rules through their controls, as special.
          const isPlayer = this.select !== undefined && slotOf(this.select, index) >= 0;
          if (this.rulesShown && !(command === 'back' && isPlayer)) {
            this.rulesPanel.command(command);
          }
        } else if (this.screen !== 'match') {
          this.menu.command(command);
        }
      }
    });
  }

  private updateCharacterSelect(ignorePresses = false): void {
    // Leaving the screen waits until every device's presses this frame are in, so whether it
    // starts or goes back does not depend on device order. Back prevents a simultaneous start.
    const before = this.select;
    const rulesWereOpen = before?.rulesOpen ?? false;
    let startRequested = false;
    let backRequested = false;
    this.adapters.devices.forEach(({ source }, device) => {
      const current = source.sample();
      const previous = this.previousInputs[device] ?? NEUTRAL_INPUT;
      this.previousInputs[device] = current;
      const state = this.select;
      if (ignorePresses || !state) return;
      const player = slotOf(state, device);
      if (player < 0) {
        // Unjoined devices navigate header actions; attack with no header focus joins.
        if (rulesWereOpen) return;
        for (const action of menuActions(player, previous, current)) {
          const now = this.select;
          if (!now) return;
          if (action.type === 'move') {
            this.select = reduceSelect(
              now,
              { ...action, type: 'guest-move', device },
              CHARACTERS,
              GRID_COLUMNS,
            );
          } else if (action.type === 'confirm') {
            const confirm = { type: 'guest-confirm' as const, device };
            if (requestsBack(now, confirm)) backRequested = true;
            this.select = reduceSelect(now, confirm, CHARACTERS, GRID_COLUMNS);
          } else if (action.type === 'cancel') backRequested = true;
        }
        return;
      }
      for (const action of menuActions(player, previous, current)) {
        const now = this.select;
        if (!now) return;
        if (requestsBack(now, action)) backRequested = true;
        if (requestsStart(now, action)) startRequested = true;
        this.select = reduceSelect(now, action, CHARACTERS, GRID_COLUMNS);
      }
    });
    // Back and rules confirmations take precedence over another device starting this frame.
    if (!backRequested && startRequested && this.select && canStart(this.select))
      return this.confirmCharacters();
    if (backRequested && !this.select?.rulesOpen) return this.leaveToMainMenu();
    if (!this.select) return;
    const cue = before ? selectCue(before, this.select) : null;
    if (cue) this.adapters.audio.play(cue);
    this.syncRulesPanel();
    this.characterSelect.render(this.select, allReady(this.select), this.rules);
  }

  private rulesMenu(): MenuContent {
    const done = (): void => {
      this.rules = this.rulesDraft;
      this.setRulesOpen(false);
    };
    return {
      heading: 'Rules',
      variant: 'menu-overlay',
      options: [
        ...ruleRows(this.rulesDraft).map((row, index) => ({
          label: row.label,
          // Enter flips the rule; numbers change only with Left/Right or − and +.
          select: () => {
            if (row.field === 'mode') this.changeRule(row.field, 1, index);
          },
          adjust: (delta: 1 | -1) => this.changeRule(row.field, delta, index),
          ...(row.field === 'mode' ? {} : { cue: null }),
          ...(row.field === 'mode' ? { stepLabels: ['‹', '›'] as const } : {}),
        })),
        { label: 'Done', select: done },
      ],
      // Escape (or special) closes without applying the changes.
      back: () => this.setRulesOpen(false),
      backButton: false,
    };
  }

  private setRulesOpen(open: boolean): void {
    if (!this.select) return;
    this.select = reduceSelect(this.select, { type: 'rules', open }, CHARACTERS, GRID_COLUMNS);
    this.syncRulesPanel();
    this.characterSelect.render(this.select, allReady(this.select), this.rules);
  }

  /** Shows or hides the rules overlay to match the character select state. */
  private syncRulesPanel(): void {
    const open = this.select?.rulesOpen ?? false;
    if (open === this.rulesShown) return;
    this.rulesShown = open;
    this.rulesDraft = this.rules;
    if (open) this.rulesPanel.show(this.rulesMenu());
    else {
      this.rulesPanel.hide();
      // DOM keys can close the overlay between frames. Consume its pending taps so they
      // cannot move a character-select cursor or activate a header action underneath.
      this.previousInputs = this.adapters.devices.map(({ source }) => source.sample());
    }
  }

  /** Changes one volume, keeps it for next time, and redraws the sound menu on its row. */
  private changeVolume(channel: AudioChannel, delta: 1 | -1, row: number): void {
    const changed = adjustVolume(this.audioSettings, channel, delta);
    if (changed[channel] === this.audioSettings[channel]) return;
    this.audioSettings = changed;
    saveAudioSettings(this.adapters.settings, this.audioSettings);
    this.applyVolume(channel);
    this.menu.show(this.menuFor('sound'), row);
  }

  private applyVolume(channel: AudioChannel): void {
    this.adapters.audio.setVolume(channel, volumeLevel(this.audioSettings[channel]));
  }

  private toggleFullscreen(): void {
    // The options menu redraws on `fullscreenchange`. Browsers may refuse, e.g. in tests.
    const change = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    change.catch(() => undefined);
  }

  /**
   * Enter on character select: only here do the joined players become the next match's
   * fighters, in slot order.
   */
  private confirmCharacters(): void {
    const state = this.select;
    if (!state || !allReady(state)) return;
    const players = state.devices.flatMap((device, slot) => {
      const pick = state.picks[slot];
      return device === null || pick == null ? [] : [{ device, pick }];
    });
    this.picks = players.map((player) => player.pick);
    this.playerDevices = players.map((player) => player.device);
    this.adapters.audio.play('menu-confirm');
    this.navigate('stage-select');
  }

  private leaveToMainMenu(): void {
    this.adapters.audio.play('menu-back');
    this.navigate('main-menu');
  }

  /** The input of a player in the match, or during character select of a joined slot. */
  private playerSource(player: number): InputSource | undefined {
    const device = this.deviceOf(player);
    return device === undefined ? undefined : this.adapters.devices[device]?.source;
  }

  private leaveCharacterSelect(): void {
    this.select = undefined;
    this.syncRulesPanel();
    this.characterSelect.hide();
  }

  private changeRule(field: RuleField, delta: 1 | -1, row: number): void {
    this.rulesDraft = adjustRule(this.rulesDraft, field, delta);
    this.rulesPanel.show(this.rulesMenu(), row);
  }

  private startMatch(): void {
    if (this.picks.length === 0 || this.picks.length !== this.playerDevices.length) {
      throw new Error('A match needs a device and a character pick for every player');
    }
    const players = this.picks.map((characterId) => ({ characterId }));
    const session = this.adapters.createSession({
      stageId: this.stageId,
      players,
      rules: this.rules,
    });
    const views = this.adapters.createViews(this.container, session.view().current.stage);
    // Drop key taps made in the menus, so the match does not start with a stray jump.
    for (const device of this.adapters.devices) device.source.sample();
    this.eliminations = [];
    const unsubscribe = session.onEvent((event) => {
      if (event.type === 'ko' && event.stocksLeft === 0) {
        this.eliminations.push({ slot: event.slot, frame: session.view().current.frame });
      }
      this.playFight(eventCue(event));
      if (event.type !== 'match-end') return;
      setTimeout(() => {
        if (this.match?.session === session) this.navigate('results');
      }, RESULTS_DELAY_MS);
    });
    this.match = { session, views, unsubscribe, heard: session.view().current };
    this.lastResult = undefined;
    this.resize();
  }

  private playFight({ cue, strength }: FightCue): void {
    this.adapters.audio.play(cue, strength);
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
