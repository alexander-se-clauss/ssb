import type { CharacterDef } from '../core';
import type { SelectState } from './character-select';

/** Same order as the HUD's player colours. */
const PLAYER_COLORS = ['#e94f4f', '#4f8fe9', '#4fd18b', '#f2c14e'];

export interface CharacterSelectCallbacks {
  /** Enter once everyone has picked. */
  readonly start: () => void;
  /** Escape. */
  readonly back: () => void;
}

/**
 * Draws the Melee-style grid: one cell per character with the players' cursors on it, and one
 * slot per player showing their pick. Only Enter and Escape are read here; picking goes
 * through each player's own controls (see `menuActions`).
 */
export class CharacterSelectView {
  private readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly slots: HTMLElement;
  private readonly footer: HTMLElement;
  private state: SelectState | undefined;
  private ready = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.state || event.repeat) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      this.callbacks.back();
    } else if (event.code === 'Enter' && this.ready) {
      event.preventDefault();
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
    const heading = document.createElement('h1');
    heading.textContent = 'Choose your fighter';
    this.grid = document.createElement('div');
    this.grid.className = 'css-grid';
    this.grid.style.setProperty('--columns', String(Math.max(1, Math.min(columns, roster.length))));
    this.slots = document.createElement('div');
    this.slots.className = 'css-slots';
    this.footer = document.createElement('p');
    this.footer.className = 'css-footer';
    this.root.append(heading, this.grid, this.slots, this.footer);
    container.append(this.root);
    window.addEventListener('keydown', this.onKeyDown);
  }

  render(state: SelectState, ready: boolean): void {
    if (state === this.state && ready === this.ready) return;
    this.state = state;
    this.ready = ready;
    this.root.hidden = false;
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
          if (cursor === index) cursors.append(this.badge(player));
        });
        cell.append(name, cursors);
        return cell;
      }),
    );
    this.slots.replaceChildren(
      ...state.picks.map((pick, player) => {
        const slot = document.createElement('div');
        slot.className = pick ? 'css-slot picked' : 'css-slot';
        slot.dataset['player'] = String(player + 1);
        slot.style.setProperty('--player-color', PLAYER_COLORS[player % 4] ?? '#fff');
        const who = document.createElement('strong');
        who.textContent = `P${player + 1}`;
        const what = document.createElement('span');
        what.textContent = pick ? (this.roster.find((c) => c.id === pick)?.name ?? pick) : '…';
        slot.append(who, what);
        return slot;
      }),
    );
    this.footer.textContent = ready
      ? 'Ready! Press Enter'
      : 'P1: WASD move · F pick · G cancel\nP2: arrows move · . pick · / cancel\nEsc: back';
    this.footer.classList.toggle('ready', ready);
  }

  hide(): void {
    this.root.hidden = true;
    this.state = undefined;
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
