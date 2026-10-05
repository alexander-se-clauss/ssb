import { NEUTRAL_INPUT, STICK, applyDeadzone, type PlayerInput } from '../../core';
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
  rightBumper: 5, // Z on a GameCube pad
  leftTrigger: 6,
  rightTrigger: 7,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/** Button names for the controls screen, matching the layout `sample()` reads. */
export const GAMEPAD_LABELS = {
  move: 'Left stick / D-pad',
  jump: 'X or stick up',
  up: 'Stick up',
  down: 'Stick down',
  attack: 'A',
  special: 'B',
  dodge: 'L / R',
  shortHop: 'Y',
  grab: 'Right bumper (Z)',
  start: 'Start',
} as const;

/** Reads every connected gamepad; `navigator.getGamepads` in the browser. */
export type GamepadReader = () => readonly (GamepadLike | null)[];

const browserGamepads: GamepadReader = () => navigator.getGamepads();

/**
 * One gamepad as a player's input, with Melee's layout: A attacks, B specials, X jumps (Y short
 * hops, #147), the triggers dodge, the right bumper grabs (#159), Start starts, the left stick or d-pad moves. The browser Gamepad API has no events for
 * buttons, so `sample()` polls the pad; the app calls it once per frame.
 */
export class GamepadInputSource implements InputSource {
  constructor(
    /**
     * `Gamepad.index`: the browser's slot for the pad. It stays the same while other pads
     * connect or disconnect, so a player keeps their pad. Players join by pressing a button on
     * character select, so it doesn't matter which slot the browser picks.
     */
    private readonly index: number,
    private readonly readGamepads: GamepadReader = browserGamepads,
  ) {}

  sample(): PlayerInput {
    const pad = this.readGamepads()[this.index];
    if (!pad) return NEUTRAL_INPUT;
    const is = (button: number): boolean => pad.buttons[button]?.pressed ?? false;
    const dpadX = (is(BUTTON.right) ? 1 : 0) - (is(BUTTON.left) ? 1 : 0);
    const dpadY = (is(BUTTON.up) ? 1 : 0) - (is(BUTTON.down) ? 1 : 0);
    const x = dpadX || applyDeadzone(pad.axes[0] ?? 0);
    // The Gamepad API reports down as positive; the game uses up as positive.
    const y = dpadY || applyDeadzone(-(pad.axes[1] ?? 0));
    return {
      x,
      y,
      // Tap-jump is a full jump, as is X; Y is the short hop button (#147).
      jump: is(BUTTON.x) || y >= STICK.tapJump,
      attack: is(BUTTON.a),
      special: is(BUTTON.b),
      shield: is(BUTTON.leftTrigger) || is(BUTTON.rightTrigger),
      shortHop: is(BUTTON.y),
      // The right bumper sits where Melee's Z is, and grabs like it (#159).
      grab: is(BUTTON.rightBumper),
      start: is(BUTTON.start),
    };
  }

  dispose(): void {
    // Polling holds no listeners.
  }
}
