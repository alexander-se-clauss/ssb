import { NEUTRAL_INPUT, STICK, type PlayerInput } from '../../core';
import type { InputSource } from '../../ports';

/** The part of the browser's `Gamepad` this adapter reads, so tests can pass plain objects. */
export interface GamepadLike {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean }[];
}

/** Button indices of the W3C Standard Gamepad layout (Xbox names; PlayStation in brackets). */
const BUTTON = {
  a: 0, // bottom face button (Cross)
  b: 1, // right face button (Circle)
  x: 2, // left face button (Square)
  y: 3, // top face button (Triangle)
  leftTrigger: 6,
  rightTrigger: 7,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/** Reads every connected gamepad; `navigator.getGamepads` in the browser. */
export type GamepadReader = () => readonly (GamepadLike | null)[];

const browserGamepads: GamepadReader = () => navigator.getGamepads();

/** Axis value with drift around the centre removed. */
const deadzoned = (value: number): number => (Math.abs(value) < STICK.deadzone ? 0 : value);

/**
 * One gamepad as a player's input, with Melee's layout: A attacks, B specials, X and Y jump,
 * the triggers shield, the left stick or d-pad moves. The browser Gamepad API has no events for
 * buttons, so `sample()` polls the pad; the app calls it once per frame.
 */
export class GamepadInputSource implements InputSource {
  constructor(
    /** `Gamepad.index`: which connected pad this player uses. */
    private readonly index: number,
    private readonly readGamepads: GamepadReader = browserGamepads,
  ) {}

  sample(): PlayerInput {
    const pad = this.readGamepads()[this.index];
    if (!pad) return NEUTRAL_INPUT;
    const is = (button: number): boolean => pad.buttons[button]?.pressed ?? false;
    const dpadX = (is(BUTTON.right) ? 1 : 0) - (is(BUTTON.left) ? 1 : 0);
    const dpadY = (is(BUTTON.up) ? 1 : 0) - (is(BUTTON.down) ? 1 : 0);
    const x = dpadX || deadzoned(pad.axes[0] ?? 0);
    // The Gamepad API reports down as positive; the game uses up as positive.
    const y = dpadY || deadzoned(-(pad.axes[1] ?? 0));
    return {
      x,
      y,
      jump: is(BUTTON.x) || is(BUTTON.y) || y >= STICK.tapJump,
      attack: is(BUTTON.a),
      special: is(BUTTON.b),
      shield: is(BUTTON.leftTrigger) || is(BUTTON.rightTrigger),
    };
  }

  dispose(): void {
    // Polling holds no listeners.
  }
}
