/**
 * A plain HTML menu drawn over the canvas: a heading, a line of text and a column of
 * buttons. Up/Down (or W/S) move the focus, Enter picks, Escape goes back. A menu without
 * buttons (the title screen) waits for Enter or Space instead.
 */
export interface MenuOption {
  readonly label: string;
  readonly select: () => void;
}

export interface MenuContent {
  readonly heading: string;
  readonly text?: string;
  /** Extra CSS class for the panel, for screens with their own look. */
  readonly variant?: string;
  readonly options?: readonly MenuOption[];
  /** Enter or Space on a menu without buttons, e.g. "press start". */
  readonly start?: () => void;
  /** Escape. */
  readonly back?: () => void;
}

const PREVIOUS_KEYS = new Set(['ArrowUp', 'KeyW']);
const NEXT_KEYS = new Set(['ArrowDown', 'KeyS']);
const START_KEYS = new Set(['Enter', 'Space']);

export class MenuPanel {
  private readonly root: HTMLElement;
  private buttons: HTMLButtonElement[] = [];
  private content: MenuContent | undefined;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const content = this.content;
    if (!content) return;
    // A held key must not click through several screens in a row.
    if (event.repeat) {
      if (START_KEYS.has(event.code)) event.preventDefault();
      return;
    }
    if (event.code === 'Escape' && content.back) {
      event.preventDefault();
      content.back();
      return;
    }
    if (this.buttons.length === 0) {
      if (START_KEYS.has(event.code) && content.start) {
        event.preventDefault();
        content.start();
      }
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

  show(content: MenuContent): void {
    const title = document.createElement('h1');
    title.textContent = content.heading;
    const body = document.createElement('p');
    body.textContent = content.text ?? '';
    this.buttons = (content.options ?? []).map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.addEventListener('click', option.select);
      return button;
    });
    this.root.className = content.variant ? `menu ${content.variant}` : 'menu';
    this.root.replaceChildren(title, body, ...this.buttons);
    this.root.hidden = false;
    this.content = content;
    this.buttons[0]?.focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
    this.buttons = [];
    this.content = undefined;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }
}
