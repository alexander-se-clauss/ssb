import { describe, expect, it } from 'vitest';
import { GamepadInputSource, type GamepadLike } from './gamepad-input-source';

/** A Standard Gamepad snapshot: 17 buttons and 4 axes, everything at rest. */
const pad = (
  pressedButtons: readonly number[] = [],
  axes: readonly number[] = [0, 0, 0, 0],
): GamepadLike => ({
  axes,
  buttons: Array.from({ length: 17 }, (_, index) => ({
    pressed: pressedButtons.includes(index),
  })),
});

const sourceFor = (...pads: (GamepadLike | null)[]) => {
  let current = pads;
  const source = new GamepadInputSource(0, () => current);
  return { source, set: (...next: (GamepadLike | null)[]) => (current = next) };
};

describe('GamepadInputSource', () => {
  it('reports neutral input while no gamepad is connected', () => {
    const { source } = sourceFor(null);
    expect(source.sample()).toEqual({
      x: 0,
      y: 0,
      jump: false,
      attack: false,
      special: false,
      shield: false,
    });
  });

  it('maps the face buttons like Melee: A attacks, B specials, X and Y jump', () => {
    const { source, set } = sourceFor(pad([0]));
    expect(source.sample()).toMatchObject({ attack: true, special: false, jump: false });
    set(pad([1]));
    expect(source.sample()).toMatchObject({ attack: false, special: true });
    set(pad([2]));
    expect(source.sample().jump).toBe(true);
    set(pad([3]));
    expect(source.sample().jump).toBe(true);
  });

  it('maps the triggers to shield', () => {
    const { source, set } = sourceFor(pad([6]));
    expect(source.sample().shield).toBe(true);
    set(pad([7]));
    expect(source.sample().shield).toBe(true);
  });

  it('reads the left stick with up as positive y', () => {
    const { source } = sourceFor(pad([], [0.5, 0.4, 0, 0]));
    expect(source.sample()).toMatchObject({ x: 0.5, y: -0.4 });
  });

  it('ignores small stick drift inside the deadzone', () => {
    const { source } = sourceFor(pad([], [0.05, -0.08, 0, 0]));
    expect(source.sample()).toMatchObject({ x: 0, y: 0 });
  });

  it('jumps when the stick is pushed far up (tap-jump), like the keyboard', () => {
    const { source, set } = sourceFor(pad([], [0, -0.5, 0, 0]));
    expect(source.sample().jump).toBe(false);
    set(pad([], [0, -0.9, 0, 0]));
    expect(source.sample().jump).toBe(true);
  });

  it('treats the d-pad as a full stick push', () => {
    const { source, set } = sourceFor(pad([15]));
    expect(source.sample()).toMatchObject({ x: 1, y: 0 });
    set(pad([14, 13]));
    expect(source.sample()).toMatchObject({ x: -1, y: -1 });
  });

  it('reads only the pad in its own browser slot, which stays put when another disconnects', () => {
    const source = new GamepadInputSource(1, () => [pad([0]), null]);
    expect(source.sample().attack).toBe(false);
    const second = new GamepadInputSource(1, () => [null, pad([1])]);
    expect(second.sample().special).toBe(true);
  });
});
