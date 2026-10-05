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
  /** The short hop button (#147). */
  readonly shortHop: string;
  /** The grab button (#159). */
  readonly grab: string;
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
  shortHop: 'KeyV',
  grab: 'KeyC',
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
  shortHop: 'Numpad1',
  grab: 'Numpad3',
};

/** Readable names for the keys a player uses, for the controls screen. */
export interface KeyLabels {
  readonly move: string;
  readonly jump: string;
  readonly up: string;
  readonly down: string;
  readonly attack: string;
  readonly special: string;
  readonly dodge: string;
  readonly shortHop: string;
  readonly grab: string;
  readonly start: string;
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Period: '.',
  Slash: '/',
  Comma: ',',
  Space: 'Space',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
};

/** `KeyA` -> `A`, `Numpad0` -> `Num 0`, `ArrowLeft` -> `←`. */
const keyName = (code: string): string =>
  KEY_NAMES[code] ??
  code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Numpad(.+)$/, 'Num $1');

export const describeKeys = (keys: KeyMap): KeyLabels => ({
  move: `${keyName(keys.left)} / ${keyName(keys.right)}`,
  jump: keyName(keys.jump),
  up: keyName(keys.up),
  down: keyName(keys.down),
  attack: keyName(keys.attack),
  special: keyName(keys.special),
  dodge: keyName(keys.shield),
  shortHop: keyName(keys.shortHop),
  grab: keyName(keys.grab),
  // Enter starts for every keyboard player, through the page's menu keys.
  start: 'Enter',
});

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
      // No tap-jump: keys are always fully pressed, so "up" only aims. Holding it is an up tilt,
      // tapping it with attack an up smash; the jump key jumps.
      jump: is(k.jump),
      attack: is(k.attack),
      special: is(k.special),
      shield: is(k.shield),
      shortHop: is(k.shortHop),
      grab: is(k.grab),
      // Enter is the keyboard's start, handled as a menu key, not per player.
      start: false,
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
