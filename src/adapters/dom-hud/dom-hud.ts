import {
  TICK_RATE,
  findCharacter,
  score,
  timeLeftFrames,
  type FighterState,
  type MatchState,
} from '../../core';
import type { GameView, SessionView } from '../../ports';
import { heat, plateLayout, stockMarks, type PlateSide } from './hud-plates';
import { BANNER_TEXT, bannerKind, type BannerKind } from './match-banner';

const PLAYER_CSS_COLORS = ['#e94f4f', '#4f8fe9', '#4fd18b', '#f2c14e'];

/** m:ss, rounded up so the clock shows 0:00 only when time is really up. */
const formatClock = (frames: number): string => {
  const seconds = Math.ceil(frames / TICK_RATE);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export interface DomHudOptions {
  /** An image of the character for the plate's diamond, if one can be made. */
  readonly portrait: (characterId: string) => string | undefined;
}

interface Plate {
  readonly element: HTMLElement;
  readonly damage: HTMLElement;
  readonly stocks: HTMLElement;
  /** What the plate shows now, so the DOM is only touched when it changes. */
  shown: string;
}

const element = (tag: string, className: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * The match HUD in the Kombat look: one plate per player across the top, half of them on each
 * side of the clock, each with a portrait diamond, the fighter's name, a damage meter that heats
 * up, the damage in gold and the lives as diamonds (score in time mode). Plain DOM over the canvas.
 */
export class DomHud implements GameView {
  private readonly root: HTMLElement;
  private readonly sides: Record<PlateSide, HTMLElement>;
  private readonly clock: HTMLElement;
  private readonly matchBanner: HTMLElement;
  private readonly matchBannerText: HTMLElement;
  private readonly plates = new Map<number, Plate>();

  constructor(
    private readonly container: HTMLElement,
    private readonly options: DomHudOptions,
  ) {
    this.root = element('div', 'hud');
    this.sides = { left: element('div', 'hud-side left'), right: element('div', 'hud-side right') };
    this.clock = element('div', 'hud-clock');
    this.clock.hidden = true;
    this.root.append(this.sides.left, this.clock, this.sides.right);
    this.matchBanner = element('div', 'match-banner');
    this.matchBanner.setAttribute('role', 'status');
    this.matchBanner.hidden = true;
    this.matchBannerText = element('span', 'match-banner-text');
    this.matchBanner.append(element('div', 'match-banner-band'), this.matchBannerText);
    container.append(this.root, this.matchBanner);
  }

  render({ current }: SessionView): void {
    if (this.plates.size === 0) this.buildPlates(current.fighters);
    for (const fighter of current.fighters) this.updatePlate(fighter, current);
    const framesLeft = timeLeftFrames(current);
    this.clock.hidden = framesLeft === null;
    if (framesLeft !== null) this.clock.textContent = formatClock(framesLeft);
    // Who won is told on the results screen, as in Melee; the match only says it is over.
    this.showBanner(bannerKind(current));
  }

  resize(): void {}

  /** How far down from the top of the screen the plates reach, in pixels. */
  coveredHeight(): number {
    const plates = this.root.getBoundingClientRect();
    return plates.height > 0 ? plates.bottom - this.container.getBoundingClientRect().top : 0;
  }

  dispose(): void {
    this.root.remove();
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

  private buildPlates(fighters: readonly FighterState[]): void {
    const layout = plateLayout(fighters.length);
    this.root.classList.toggle('compact', layout.compact);
    fighters.forEach((fighter, index) => {
      const side = layout.sides[index] ?? 'right';
      const plate = element('div', `hud-plate ${side}`);
      plate.style.setProperty('--player-color', PLAYER_CSS_COLORS[fighter.slot % 4] ?? '#fff');

      const portrait = element('div', 'hud-portrait');
      const image = this.options.portrait(fighter.characterId);
      const frame = element('div', 'hud-portrait-frame');
      portrait.append(frame);
      if (image !== undefined) {
        const img = document.createElement('img');
        img.src = image;
        img.alt = '';
        frame.append(img);
      }
      const name = findCharacter(fighter.characterId)?.name ?? fighter.characterId;
      const head = element('div', 'hud-head');
      head.append(
        element('span', 'hud-player', `P${fighter.slot + 1}`),
        element('span', 'hud-name', name),
      );
      const meter = element('div', 'hud-meter');
      meter.append(element('div', 'hud-meter-fill'));
      const damage = element('div', 'hud-damage');
      const stocks = element('div', 'hud-stocks');
      const foot = element('div', 'hud-foot');
      foot.append(stocks, damage);
      const body = element('div', 'hud-body');
      body.append(head, meter, foot);
      plate.append(portrait, body);
      this.sides[side].append(plate);
      this.plates.set(fighter.slot, { element: plate, damage, stocks, shown: '' });
    });
  }

  private updatePlate(fighter: FighterState, match: MatchState): void {
    const plate = this.plates.get(fighter.slot);
    if (!plate) return;
    const damage = Math.round(fighter.damage);
    const shown = `${damage}|${fighter.stocks}|${score(fighter)}`;
    if (plate.shown === shown) return;
    plate.shown = shown;
    plate.damage.textContent = `${damage}%`;
    plate.element.style.setProperty('--heat', heat(fighter.damage).toFixed(3));
    // Training (#144) counts neither lives nor score.
    if (match.training) {
      plate.stocks.textContent = '';
      return;
    }
    if (match.rules.mode === 'time') {
      const points = score(fighter);
      plate.stocks.textContent = points > 0 ? `+${points}` : String(points);
      return;
    }
    plate.element.classList.toggle('out', fighter.stocks <= 0);
    const marks = stockMarks(fighter.stocks, match.rules.stocks);
    if (marks === null) {
      plate.stocks.textContent = `◆ × ${fighter.stocks}`;
      return;
    }
    plate.stocks.replaceChildren(
      ...marks.map((alive) => element('span', alive ? 'hud-stock' : 'hud-stock lost')),
    );
  }
}
