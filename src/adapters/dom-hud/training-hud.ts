import type { GameView, SessionView } from '../../ports';
import { trainingReadout, type TrainingReadout } from './training-readout';

const PHASE_LABEL = { startup: 'Startup', active: 'Active', endlag: 'Endlag' } as const;

const row = (label: string): { element: HTMLElement; value: HTMLElement } => {
  const element = document.createElement('div');
  element.className = 'training-row';
  const name = document.createElement('span');
  name.className = 'training-label';
  name.textContent = label;
  const value = document.createElement('span');
  value.className = 'training-value';
  element.append(name, value);
  return { element, value };
};

/**
 * The training readout (#144) in the bottom left corner: the combo counter (lit while the combo
 * runs), the last hit's frame advantage, the current move's frame and frame data, and whether the
 * last aerial landing was L-cancelled (#149).
 */
export class TrainingHud implements GameView {
  private readonly root: HTMLElement;
  private readonly combo = row('Combo');
  private readonly advantage = row('Advantage');
  private readonly move = row('Move');
  private readonly frames = row('Frames');
  private readonly lCancel = row('L-cancel');
  private shown = '';

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'training-hud';
    this.root.setAttribute('aria-live', 'polite');
    this.root.append(
      this.combo.element,
      this.advantage.element,
      this.move.element,
      this.frames.element,
      this.lCancel.element,
    );
    container.append(this.root);
  }

  render({ current }: SessionView): void {
    const readout = trainingReadout(current);
    this.root.hidden = readout === null;
    if (!readout) return;
    const key = JSON.stringify(readout);
    if (key === this.shown) return;
    this.shown = key;
    this.show(readout);
  }

  private show(readout: TrainingReadout): void {
    this.combo.value.textContent =
      readout.comboHits > 0
        ? `${readout.comboHits} ${readout.comboHits === 1 ? 'hit' : 'hits'} · ${readout.comboDamage}%`
        : '–';
    this.combo.element.classList.toggle('live', readout.comboActive);
    this.advantage.value.textContent = readout.advantage;
    const { move } = readout;
    this.move.value.textContent = move
      ? move.frame === null || move.phase === null
        ? move.name
        : `${move.name} · ${move.frame} ${PHASE_LABEL[move.phase]}`
      : '–';
    this.frames.value.textContent = move
      ? `${move.active ? `active ${move.active[0]}–${move.active[1]} · ` : ''}total ${move.total}`
      : '–';
    this.lCancel.value.textContent = readout.lCancel;
  }

  resize(): void {}

  dispose(): void {
    this.root.remove();
  }
}
