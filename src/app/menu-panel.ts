/**
 * A plain HTML menu drawn over the canvas: a heading, a line of text and a column of
 * buttons. Up/Down (or W/S) move the focus, Enter picks. The real screens (title, character
 * select, ...) replace these placeholders one by one in the sprint-1 issues.
 */
export interface MenuOption {
  readonly label: string;
  readonly select: () => void;
}

const PREVIOUS_KEYS = new Set(['ArrowUp', 'KeyW']);
const NEXT_KEYS = new Set(['ArrowDown', 'KeyS']);

export class MenuPanel {
  private readonly root: HTMLElement;
  private buttons: HTMLButtonElement[] = [];

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.root.hidden || this.buttons.length === 0) return;
    // A held Enter must not click through several screens in a row.
    if (event.code === 'Enter' && event.repeat) {
      event.preventDefault();
      return;
    }
    const step = PREVIOUS_KEYS.has(event.code) ? -1 : NEXT_KEYS.has(event.code) ? 1 : 0;
    if (step === 0) return;
    const index = this.buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (index + step + this.buttons.length) % this.buttons.length;
    this.buttons[next]?.focus();
    event.preventDefault();
  };

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'menu';
    this.root.hidden = true;
    container.append(this.root);
    window.addEventListener('keydown', this.onKeyDown);
  }

  show(heading: string, text: string, options: readonly MenuOption[]): void {
    const title = document.createElement('h1');
    title.textContent = heading;
    const body = document.createElement('p');
    body.textContent = text;
    this.buttons = options.map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.addEventListener('click', option.select);
      return button;
    });
    this.root.replaceChildren(title, body, ...this.buttons);
    this.root.hidden = false;
    this.buttons[0]?.focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
    this.buttons = [];
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }
}
