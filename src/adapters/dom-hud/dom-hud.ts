import { TICK_RATE, score, timeLeftFrames, type FighterState, type MatchState } from '../../core';
import type { GameView, SessionView } from '../../ports';
import { BANNER_TEXT, bannerKind, type BannerKind } from './match-banner';

const MAX_STOCK_DOTS = 5;

const PLAYER_CSS_COLORS = ['#e94f4f', '#4f8fe9', '#4fd18b', '#f2c14e'];

/** m:ss, rounded up so the clock shows 0:00 only when time is really up. */
const formatClock = (frames: number): string => {
  const seconds = Math.ceil(frames / TICK_RATE);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/**
 * Damage percent, stocks (stock rule) or score (time rule), and the match clock, drawn as
 * plain DOM on top of the canvas.
 */
export class DomHud implements GameView {
  private readonly root: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly matchBanner: HTMLElement;
  private readonly matchBannerText: HTMLElement;
  private readonly cards = new Map<number, { damage: HTMLElement; stocks: HTMLElement }>();

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.clock = document.createElement('div');
    this.clock.className = 'hud-clock';
    this.clock.hidden = true;
    this.matchBanner = document.createElement('div');
    this.matchBanner.className = 'match-banner';
    this.matchBanner.setAttribute('role', 'status');
    this.matchBanner.hidden = true;
    const band = document.createElement('div');
    band.className = 'match-banner-band';
    this.matchBannerText = document.createElement('span');
    this.matchBannerText.className = 'match-banner-text';
    this.matchBanner.append(band, this.matchBannerText);
    container.append(this.root, this.clock, this.matchBanner);
  }

  render({ current }: SessionView): void {
    for (const fighter of current.fighters) this.updateCard(fighter, current);
    const framesLeft = timeLeftFrames(current);
    this.clock.hidden = framesLeft === null;
    if (framesLeft !== null) this.clock.textContent = formatClock(framesLeft);
    // Who won is told on the results screen, as in Melee; the match only says it is over.
    this.showBanner(bannerKind(current));
  }

  resize(): void {}

  dispose(): void {
    this.root.remove();
    this.clock.remove();
    this.matchBanner.remove();
  }

  /** Each kind has its own entrance animation in CSS, which restarts when the kind changes. */
  private showBanner(kind: BannerKind | null): void {
    const shown = this.matchBanner.hidden ? null : (this.matchBanner.dataset['kind'] ?? null);
    if (shown === kind) return;
    this.matchBanner.hidden = kind === null;
    if (kind === null) return;
    this.matchBanner.dataset['kind'] = kind;
    this.matchBannerText.textContent = BANNER_TEXT[kind];
  }

  private updateCard(fighter: FighterState, match: MatchState): void {
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
    if (match.rules.mode === 'stock') {
      // A row of dots for a few lives, a count once there are too many to read at a glance.
      card.stocks.textContent =
        fighter.stocks <= MAX_STOCK_DOTS ? '●'.repeat(fighter.stocks) : `● × ${fighter.stocks}`;
    } else {
      const points = score(fighter);
      card.stocks.textContent = points > 0 ? `+${points}` : String(points);
    }
  }
}
