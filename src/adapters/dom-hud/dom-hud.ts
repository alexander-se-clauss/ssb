import type { FighterState } from '../../core';
import type { GameView, SessionView } from '../../ports';

const PLAYER_CSS_COLORS = ['#e94f4f', '#4f8fe9', '#4fd18b', '#f2c14e'];

/** Damage percent and stock display, drawn as plain DOM on top of the canvas. */
export class DomHud implements GameView {
  private readonly root: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly cards = new Map<number, { damage: HTMLElement; stocks: HTMLElement }>();

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.banner = document.createElement('div');
    this.banner.className = 'hud-banner';
    this.banner.hidden = true;
    container.append(this.root, this.banner);
  }

  render({ current }: SessionView): void {
    for (const fighter of current.fighters) this.updateCard(fighter);
    if (current.phase === 'finished') {
      this.banner.hidden = false;
      this.banner.textContent =
        current.winner === null ? 'Draw!' : `Player ${current.winner + 1} wins! Press R to restart`;
    } else {
      this.banner.hidden = true;
    }
  }

  resize(): void {}

  dispose(): void {
    this.root.remove();
    this.banner.remove();
  }

  private updateCard(fighter: FighterState): void {
    let card = this.cards.get(fighter.slot);
    if (!card) {
      const element = document.createElement('div');
      element.className = 'hud-card';
      element.style.setProperty('--player-color', PLAYER_CSS_COLORS[fighter.slot % 4] ?? '#fff');
      const name = document.createElement('div');
      name.className = 'hud-name';
      name.textContent = `P${fighter.slot + 1}`;
      const damage = document.createElement('div');
      damage.className = 'hud-damage';
      const stocks = document.createElement('div');
      stocks.className = 'hud-stocks';
      element.append(name, damage, stocks);
      this.root.append(element);
      card = { damage, stocks };
      this.cards.set(fighter.slot, card);
    }
    card.damage.textContent = `${Math.round(fighter.damage)}%`;
    card.stocks.textContent = '●'.repeat(fighter.stocks);
  }
}
