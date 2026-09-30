import type { PlayerInput } from '../../core';
import type { InputSource } from '../../ports';

/** Physical key codes (`KeyboardEvent.code`), so layouts like AZERTY or QWERTZ still work. */
export interface KeyMap {
  readonly left: string;
  readonly right: string;
  readonly up: string;
  readonly down: string;
  readonly jump: string;
  readonly attack: string;
  readonly special: string;
  readonly shield: string;
}

export const PLAYER_ONE_KEYS: KeyMap = {
  left: 'KeyA',
  right: 'KeyD',
  up: 'KeyW',
  down: 'KeyS',
  jump: 'Space',
  attack: 'KeyF',
  special: 'KeyG',
  shield: 'KeyH',
};

export const PLAYER_TWO_KEYS: KeyMap = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  jump: 'Numpad0',
  attack: 'Period',
  special: 'Slash',
  shield: 'ShiftRight',
};

export class KeyboardInputSource implements InputSource {
  private readonly held = new Set<string>();
  /** Keys pressed since the last sample, so a tap shorter than one frame is not lost. */
  private readonly tapped = new Set<string>();

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.handles(event.code)) {
      this.held.add(event.code);
      this.tapped.add(event.code);
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    this.tapped.clear();
  };

  constructor(
    private readonly keys: KeyMap,
    private readonly target: EventTarget = window,
  ) {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
    target.addEventListener('blur', this.onBlur);
  }

  sample(): PlayerInput {
    const is = (code: string): boolean => this.held.has(code) || this.tapped.has(code);
    const k = this.keys;
    const input: PlayerInput = {
      x: (is(k.right) ? 1 : 0) - (is(k.left) ? 1 : 0),
      y: (is(k.up) ? 1 : 0) - (is(k.down) ? 1 : 0),
      // Tap-jump: "up" also jumps, like the default Smash controls.
      jump: is(k.jump) || is(k.up),
      attack: is(k.attack),
      special: is(k.special),
      shield: is(k.shield),
    };
    this.tapped.clear();
    return input;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    this.target.removeEventListener('blur', this.onBlur);
  }

  private handles(code: string): boolean {
    return Object.values(this.keys).includes(code);
  }
}
