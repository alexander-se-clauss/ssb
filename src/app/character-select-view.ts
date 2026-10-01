import { markHandled, wasHandled } from './key-events';
import type { CharacterDef, MatchRules } from '../core';
import { RULES_CURSOR, type SelectState } from './character-select';
import { ruleSummary } from './rules-menu';

/** Same order as the HUD's player colours. */
const PLAYER_COLORS = ['#e94f4f', '#4f8fe9', '#4fd18b', '#f2c14e'];

export interface CharacterSelectCallbacks {
  /** Enter once everyone has picked. */
  readonly start: () => void;
  /** Escape or the Back button. */
  readonly back: () => void;
  /** A click on the rules banner. */
  readonly openRules: () => void;
}

/**
 * Draws the Melee-style match setup: a top bar with Back and the rules banner, the grid with one
 * cell per character and the players' cursors on it, and one slot per player showing their pick.
 * Only Enter, Escape and clicks are read here; picking goes through each player's own controls
 * (see `menuActions`). The rules overlay itself is a `MenuPanel` owned by the app.
 */
export class CharacterSelectView {
  private readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly slots: HTMLElement;
  private readonly footer: HTMLElement;
  private readonly rulesBanner: HTMLButtonElement;
  private readonly rulesText: HTMLElement;
  private readonly rulesCursors: HTMLElement;
  private state: SelectState | undefined;
  private ready = false;
  private rules: MatchRules | undefined;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.state || this.state.rulesOpen || event.repeat || wasHandled(event)) return;
    if (event.code === 'Escape') {
      markHandled(event);
      this.callbacks.back();
    } else if (event.code === 'Enter' && this.ready) {
      markHandled(event);
      this.callbacks.start();
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
    back.addEventListener('click', () => callbacks.back());
    this.rulesBanner = document.createElement('button');
    this.rulesBanner.type = 'button';
    this.rulesBanner.className = 'css-rules';
    this.rulesBanner.addEventListener('click', () => callbacks.openRules());
    const mode = document.createElement('span');
    mode.className = 'css-mode';
    mode.textContent = 'VS. Mode';
    this.rulesText = document.createElement('strong');
    this.rulesCursors = document.createElement('div');
    this.rulesCursors.className = 'css-cursors';
    this.rulesBanner.append(mode, this.rulesText, this.rulesCursors);
    topBar.append(back, this.rulesBanner);
    const heading = document.createElement('h1');
    heading.textContent = 'Choose your fighter';
    this.grid = document.createElement('div');
    this.grid.className = 'css-grid';
    this.grid.style.setProperty('--columns', String(Math.max(1, Math.min(columns, roster.length))));
    this.slots = document.createElement('div');
    this.slots.className = 'css-slots';
    this.footer = document.createElement('p');
    this.footer.className = 'css-footer';
    this.root.append(topBar, heading, this.grid, this.slots, this.footer);
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
    this.rulesCursors.replaceChildren(
      ...state.cursors.flatMap((cursor, player) =>
        cursor === RULES_CURSOR && state.devices[player] != null ? [this.badge(player)] : [],
      ),
    );
    this.grid.replaceChildren(
      ...this.roster.map((character, index) => {
        const cell = document.createElement('div');
        cell.className = 'css-cell';
        cell.dataset['character'] = character.id;
        const name = document.createElement('span');
        name.textContent = character.name;
        const cursors = document.createElement('div');
        cursors.className = 'css-cursors';
        state.cursors.forEach((cursor, player) => {
          if (cursor === index && state.devices[player] != null) cursors.append(this.badge(player));
        });
        cell.append(name, cursors);
        return cell;
      }),
    );
    this.slots.replaceChildren(
      ...state.picks.map((pick, player) => {
        const slot = document.createElement('div');
        const joined = state.devices[player] != null;
        slot.className = !joined ? 'css-slot empty' : pick ? 'css-slot picked' : 'css-slot';
        slot.dataset['player'] = String(player + 1);
        slot.style.setProperty('--player-color', PLAYER_COLORS[player % 4] ?? '#fff');
        const who = document.createElement('strong');
        who.textContent = `P${player + 1}`;
        const what = document.createElement('span');
        what.textContent = !joined
          ? 'Press attack'
          : pick
            ? (this.roster.find((c) => c.id === pick)?.name ?? pick)
            : '…';
        slot.append(who, what);
        return slot;
      }),
    );
    this.footer.textContent = ready ? 'Ready! Press Enter or attack' : '';
    this.footer.classList.toggle('ready', ready);
  }

  hide(): void {
    this.root.hidden = true;
    this.state = undefined;
    this.rules = undefined;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private badge(player: number): HTMLElement {
    const badge = document.createElement('span');
    badge.className = 'css-badge';
    badge.textContent = `P${player + 1}`;
    badge.style.setProperty('--player-color', PLAYER_COLORS[player % 4] ?? '#fff');
    return badge;
  }
}
