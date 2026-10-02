import { markHandled, wasHandled } from './key-events';
import type { CharacterDef, MatchRules } from '../core';
import {
  BACK_CURSOR,
  RULES_CURSOR,
  lobbyStands,
  type LobbyStand,
  type SelectState,
} from './character-select';
import { ruleSummary } from './rules-menu';

/** Same order as the HUD's player colours. */
const PLAYER_COLORS = ['#e94f4f', '#4f8fe9', '#4fd18b', '#f2c14e'];
const PLAYER_NAMES = ['Player one', 'Player two', 'Player three', 'Player four'];

export interface CharacterSelectCallbacks {
  readonly portrait: (character: CharacterDef) => string;
  readonly deviceName: (device: number) => string;
  /** Enter once everyone has picked. */
  readonly start: () => void;
  /** Escape or the Back button. */
  readonly back: () => void;
  /** A click on the rules banner. */
  readonly openRules: () => void;
  /** What stands on each player's platform, after every change. */
  readonly stands: (stands: readonly LobbyStand[]) => void;
}

/**
 * Draws the Melee-style match setup: a top bar with Back and the rules banner, the roster with one
 * cell per character and the players' cursors on it, and one nameplate per player under their
 * platform. The platforms themselves are a 3D scene the app puts into `stage`.
 * Only Enter, Escape and clicks are read here; picking goes through each player's own controls
 * (see `menuActions`). The rules overlay itself is a `MenuPanel` owned by the app.
 */
export class CharacterSelectView {
  /** Holds the 3D platforms, behind everything else. */
  readonly stage: HTMLElement;
  private readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly slots: HTMLElement;
  private readonly footer: HTMLElement;
  private readonly rulesBanner: HTMLButtonElement;
  private readonly rulesText: HTMLElement;
  private readonly backButton: HTMLButtonElement;
  private state: SelectState | undefined;
  private ready = false;
  private rules: MatchRules | undefined;
  private readonly browsing = new Map<number, string>();

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.state || this.state.rulesOpen || event.repeat || wasHandled(event)) return;
    if (event.code === 'Escape') {
      markHandled(event);
      this.callbacks.back();
    } else if (event.code === 'Enter') {
      const focus = document.activeElement;
      const header =
        focus === this.backButton
          ? this.backButton
          : focus === this.rulesBanner
            ? this.rulesBanner
            : undefined;
      if (header) {
        markHandled(event);
        header.click();
      } else if (this.ready) {
        markHandled(event);
        this.callbacks.start();
      }
    }
  };

  constructor(
    container: HTMLElement,
    private readonly roster: readonly CharacterDef[],
    columns: number,
    private readonly callbacks: CharacterSelectCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'css';
    this.root.hidden = true;
    const topBar = document.createElement('div');
    topBar.className = 'css-topbar';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'menu-back';
    back.textContent = '◀ Back';
    back.setAttribute('aria-label', 'Back');
    back.addEventListener('click', () => callbacks.back());
    this.backButton = back;
    this.rulesBanner = document.createElement('button');
    this.rulesBanner.type = 'button';
    this.rulesBanner.className = 'css-rules';
    this.rulesBanner.setAttribute('aria-label', 'Match rules');
    this.rulesBanner.addEventListener('click', () => callbacks.openRules());
    const mode = document.createElement('span');
    mode.className = 'css-mode';
    mode.textContent = 'VS. Mode';
    this.rulesText = document.createElement('strong');
    this.rulesBanner.append(mode, this.rulesText);
    const heading = document.createElement('h1');
    heading.textContent = 'Choose Your Fighter';
    topBar.append(back, heading, this.rulesBanner);
    this.grid = document.createElement('div');
    this.grid.className = 'css-grid';
    this.grid.style.setProperty('--columns', String(Math.max(1, Math.min(columns, roster.length))));
    this.grid.dataset['size'] = String(roster.length);
    this.grid.setAttribute('aria-label', 'Fighter roster');
    this.slots = document.createElement('div');
    this.slots.className = 'css-slots';
    this.footer = document.createElement('p');
    this.footer.className = 'css-footer';
    const rosterFrame = document.createElement('section');
    rosterFrame.className = 'css-roster';
    rosterFrame.append(this.grid);
    this.stage = document.createElement('div');
    this.stage.className = 'css-stage';
    this.root.append(this.stage, topBar, rosterFrame, this.slots, this.footer);
    container.append(this.root);
    window.addEventListener('keydown', this.onKeyDown);
  }

  render(state: SelectState, ready: boolean, rules: MatchRules): void {
    if (state === this.state && ready === this.ready && rules === this.rules) return;
    this.state = state;
    this.ready = ready;
    this.rules = rules;
    this.root.hidden = false;
    this.rulesText.textContent = ruleSummary(rules);
    this.rulesBanner.title = 'Rules: move up here and pick, or click';
    this.grid.replaceChildren(
      ...this.roster.map((character, index) => {
        const cell = document.createElement('div');
        cell.className = 'css-cell';
        cell.dataset['character'] = character.id;
        const name = document.createElement('span');
        name.textContent = character.name;
        const cursors = document.createElement('div');
        cursors.className = 'css-cursors';
        cursors.append(...this.cursorsAt(state, index));
        const portrait = document.createElement('img');
        portrait.className = 'css-portrait';
        portrait.src = this.callbacks.portrait(character);
        portrait.alt = `${character.name} fighter portrait`;
        name.className = 'css-fighter-name';
        cell.append(portrait, name, cursors);
        return cell;
      }),
    );
    state.devices.forEach((device, player) => {
      const hovered = this.roster[state.cursors[player] ?? -1];
      if (device != null && hovered) this.browsing.set(device, hovered.id);
    });
    const stands = lobbyStands(state, this.roster, this.browsing);
    this.slots.replaceChildren(
      ...stands.map((stand, player) => {
        const device = state.devices[player];
        const joined = device != null;
        const character = this.roster.find((c) => c.id === stand.characterId);
        const slot = document.createElement('div');
        slot.className = !joined ? 'css-slot empty' : stand.ready ? 'css-slot picked' : 'css-slot';
        slot.dataset['player'] = String(player + 1);
        if (character) slot.dataset['character'] = character.id;
        slot.style.setProperty('--player-color', PLAYER_COLORS[player % 4] ?? '#fff');
        const label = document.createElement('span');
        label.className = 'css-player-label';
        label.textContent = PLAYER_NAMES[player] ?? `Player ${player + 1}`;
        const name = document.createElement('strong');
        name.className = 'css-player-name';
        name.textContent = joined ? (character?.name ?? '') : 'Press Attack';
        const status = !joined ? 'Join' : stand.ready ? 'Ready' : 'Choosing';
        const detail = document.createElement('small');
        detail.className = 'css-player-device';
        detail.textContent = joined
          ? `${this.callbacks.deviceName(device)} · ${status}`
          : 'Keyboard / Gamepad';
        slot.setAttribute('aria-label', `Player ${player + 1}: ${status}`);
        slot.append(label, name, detail);
        return slot;
      }),
    );
    this.callbacks.stands(stands);
    this.footer.replaceChildren();
    if (ready) {
      const title = document.createElement('strong');
      title.textContent = 'Ready to Fight';
      const instruction = document.createElement('span');
      instruction.textContent = 'Press Enter, Start or Attack';
      this.footer.append(title, instruction);
    }
    this.footer.classList.toggle('ready', ready);
    if (!state.rulesOpen) {
      const player = state.activeDevice === null ? -1 : state.devices.indexOf(state.activeDevice);
      const cursor =
        player >= 0 ? state.cursors[player] : state.guestCursors[state.activeDevice ?? -1];
      const header =
        cursor === BACK_CURSOR
          ? this.backButton
          : cursor === RULES_CURSOR
            ? this.rulesBanner
            : undefined;
      if (header) header.focus({ preventScroll: true });
      else if (
        document.activeElement === this.backButton ||
        document.activeElement === this.rulesBanner
      ) {
        (document.activeElement as HTMLButtonElement).blur();
      }
    }
  }

  hide(): void {
    this.root.hidden = true;
    this.state = undefined;
    this.rules = undefined;
    this.browsing.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private marker(player: number, picked: boolean): HTMLElement {
    const badge = document.createElement('span');
    badge.className = picked ? 'css-badge locked' : 'css-badge';
    badge.title = picked ? `P${player + 1} ready` : `P${player + 1} choosing`;
    badge.textContent = `P${player + 1}`;
    badge.style.setProperty('--player-color', PLAYER_COLORS[player % 4] ?? '#fff');
    return badge;
  }

  private cursorsAt(state: SelectState, target: number): HTMLElement[] {
    const players = state.cursors.flatMap((cursor, player) =>
      state.devices[player] != null &&
      (cursor === target || state.picks[player] === this.roster[target]?.id)
        ? [this.marker(player, state.picks[player] === this.roster[target]?.id)]
        : [],
    );
    return players;
  }
}
