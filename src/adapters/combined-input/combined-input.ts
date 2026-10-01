import { NEUTRAL_INPUT, type PlayerInput } from '../../core';
import type { InputSource } from '../../ports';

const furthest = (a: number, b: number): number => (Math.abs(b) > Math.abs(a) ? b : a);

/** Several devices driving one player, e.g. a keyboard half and a gamepad. */
export class CombinedInput implements InputSource {
  constructor(private readonly devices: readonly InputSource[]) {}

  sample(): PlayerInput {
    // Sample every device each frame, so keyboard taps do not pile up in an unread one.
    return this.devices
      .map((device) => device.sample())
      .reduce(
        (merged, input) => ({
          x: furthest(merged.x, input.x),
          y: furthest(merged.y, input.y),
          jump: merged.jump || input.jump,
          attack: merged.attack || input.attack,
          special: merged.special || input.special,
          shield: merged.shield || input.shield,
        }),
        NEUTRAL_INPUT,
      );
  }

  dispose(): void {
    for (const device of this.devices) device.dispose();
  }
}
