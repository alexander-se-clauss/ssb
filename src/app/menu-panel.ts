/**
 * A plain HTML menu drawn over the canvas: a heading, a line of text and a column of
 * buttons. Up/Down (or W/S) move the focus, Enter picks, Left/Right (or A/D) change a setting,
 * Escape or the Back button in the corner goes back. A setting row also has − and + buttons
 * for the mouse. A menu without buttons (the title screen) waits for Enter or Space instead.
 */
import { markHandled, wasHandled } from './key-events';

export interface MenuOption {
  readonly label: string;
  readonly select: () => void;
  /** Left (-1) or Right (+1) on a setting row. */
  readonly adjust?: (delta: 1 | -1) => void;
  /** Text on the mouse buttons for Left and Right; − and + by default, ‹ › suit a choice. */
  readonly stepLabels?: readonly [string, string];
}

export interface MenuContent {
  readonly heading: string;
  readonly text?: string;
  /** Extra content under the text, e.g. the results table. */
  readonly body?: Node;
  /** Extra CSS class for the panel, for screens with their own look. */
  readonly variant?: string;
  readonly options?: readonly MenuOption[];
  /** Enter or Space on a menu without buttons, e.g. "press start". */
  readonly start?: () => void;
  /** Escape, and the Back button in the top left corner. */
  readonly back?: () => void;
  /** False hides the Back button, e.g. when an option already says where back goes. */
  readonly backButton?: boolean;
  /** Drawn next to the buttons for the focused option, e.g. a stage preview. */
  readonly preview?: (optionIndex: number) => Node | null;
}

const PREVIOUS_KEYS = new Set(['ArrowUp', 'KeyW']);
const NEXT_KEYS = new Set(['ArrowDown', 'KeyS']);
const START_KEYS = new Set(['Enter', 'Space']);
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);

export class MenuPanel {
  private readonly root: HTMLElement;
  private buttons: HTMLButtonElement[] = [];
  private content: MenuContent | undefined;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const content = this.content;
    if (!content || wasHandled(event)) return;
    // A held key must not click through several screens in a row.
    if (event.repeat) {
      if (START_KEYS.has(event.code)) markHandled(event);
      return;
    }
    if (event.code === 'Escape' && content.back) {
      markHandled(event);
      content.back();
      return;
    }
    if (this.buttons.length === 0) {
      if (START_KEYS.has(event.code) && content.start) {
        markHandled(event);
        content.start();
      }
      return;
    }
    const index = this.buttons.indexOf(document.activeElement as HTMLButtonElement);
    const adjust = content.options?.[index]?.adjust;
    const delta = LEFT_KEYS.has(event.code) ? -1 : RIGHT_KEYS.has(event.code) ? 1 : 0;
    if (adjust && delta !== 0) {
      markHandled(event);
      adjust(delta);
      return;
    }
    const step = PREVIOUS_KEYS.has(event.code) ? -1 : NEXT_KEYS.has(event.code) ? 1 : 0;
    if (step === 0) return;
    const next = (index + step + this.buttons.length) % this.buttons.length;
    this.buttons[next]?.focus();
    markHandled(event);
  };

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'menu';
    this.root.hidden = true;
    container.append(this.root);
    window.addEventListener('keydown', this.onKeyDown);
  }

  /** Shows `content`, focusing the button at `focus` (the first one by default). */
  show(content: MenuContent, focus = 0): void {
    const title = document.createElement('h1');
    title.textContent = content.heading;
    const body = document.createElement('p');
    body.textContent = content.text ?? '';
    body.hidden = !content.text;
    const rows: HTMLElement[] = [];
    this.buttons = (content.options ?? []).map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      button.addEventListener('click', option.select);
      const adjust = option.adjust;
      if (!adjust) {
        rows.push(button);
        return button;
      }
      // − and + are for the mouse; the keyboard uses Left and Right on the row itself.
      const stepper = (text: string, delta: 1 | -1, label: string): HTMLButtonElement => {
        const step = document.createElement('button');
        step.type = 'button';
        step.className = 'menu-step';
        step.tabIndex = -1;
        step.textContent = text;
        step.setAttribute('aria-label', `${label} ${option.label}`);
        // Keep the focus on the row, so the keyboard still works after a click.
        step.addEventListener('mousedown', (event) => event.preventDefault());
        step.addEventListener('click', () => adjust(delta));
        return step;
      };
      const row = document.createElement('div');
      row.className = 'menu-row';
      const [lower, raise] = option.stepLabels ?? ['−', '+'];
      row.append(stepper(lower, -1, 'Lower'), button, stepper(raise, 1, 'Raise'));
      rows.push(row);
      return button;
    });
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'menu-back';
    back.textContent = '◀ Back';
    back.hidden = !content.back || content.backButton === false;
    if (content.back) back.addEventListener('click', content.back);
    const preview = content.preview;
    const previewBox = document.createElement('div');
    previewBox.className = 'menu-preview';
    previewBox.hidden = !preview;
    if (preview) {
      this.buttons.forEach((button, index) =>
        button.addEventListener('focus', () => {
          // Options without a preview (like Back) keep showing the last one.
          const node = preview(index);
          if (node) previewBox.replaceChildren(node);
        }),
      );
    }
    this.root.className = content.variant ? `menu ${content.variant}` : 'menu';
    this.root.replaceChildren(back, title, body, previewBox, content.body ?? '', ...rows);
    this.root.hidden = false;
    this.content = content;
    (this.buttons[focus] ?? this.buttons[0])?.focus();
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
