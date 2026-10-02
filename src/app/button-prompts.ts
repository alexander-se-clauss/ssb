/**
 * The button bar at the bottom of a menu screen: which button does what here, named for the kind
 * of device the player used last, as console fighting games do.
 */

import { GAMEPAD_LABELS } from '../adapters/gamepad-input/gamepad-input-source';

/** Keyboard keys reach menus as DOM events; gamepads through `MenuPanel.command`. */
export type DeviceKind = 'keyboard' | 'gamepad';

/**
 * Which kind of device was used last, anywhere in the app. `App` notes gamepad presses on every
 * screen and key presses anywhere; menu panels redraw their bar when it changes.
 */
export class LastDevice {
  private current: DeviceKind = 'keyboard';
  private readonly listeners = new Set<() => void>();

  get kind(): DeviceKind {
    return this.current;
  }

  use(kind: DeviceKind): void {
    if (this.current === kind) return;
    this.current = kind;
    for (const listener of this.listeners) listener();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export interface ButtonPrompt {
  readonly button: string;
  readonly action: string;
}

/** What a menu screen offers, as far as the bar needs to know. */
export interface PromptSource {
  readonly options?: readonly { readonly label: string; readonly adjust?: unknown }[];
  readonly start?: unknown;
  readonly back?: unknown;
}

const BUTTONS: Readonly<Record<DeviceKind, Record<'confirm' | 'change' | 'back', string>>> = {
  keyboard: { confirm: 'Enter', change: '←→', back: 'Esc' },
  // Melee's layout, named as on the controls screen: attack picks, special goes back.
  gamepad: { confirm: GAMEPAD_LABELS.attack, change: '◀▶', back: GAMEPAD_LABELS.special },
};

export const menuPrompts = (menu: PromptSource, device: DeviceKind): ButtonPrompt[] => {
  const buttons = BUTTONS[device];
  const options = menu.options ?? [];
  const prompts: ButtonPrompt[] = [];
  if (options.length > 0) prompts.push({ button: buttons.confirm, action: 'Select' });
  else if (menu.start) prompts.push({ button: buttons.confirm, action: 'Start' });
  if (options.some((option) => option.adjust)) {
    prompts.push({ button: buttons.change, action: 'Change' });
  }
  if (menu.back) prompts.push({ button: buttons.back, action: 'Back' });
  return prompts;
};

/** The bar as HTML; the prompts are text, so screen readers read them as a list. */
export const renderPrompts = (element: HTMLElement, prompts: readonly ButtonPrompt[]): void => {
  element.replaceChildren(
    ...prompts.map(({ button, action }) => {
      const item = document.createElement('li');
      const key = document.createElement('kbd');
      const label = document.createElement('span');
      label.textContent = button;
      key.append(label);
      key.dataset['wide'] = String(button.length > 1);
      item.append(key, action);
      return item;
    }),
  );
  element.hidden = prompts.length === 0;
};
