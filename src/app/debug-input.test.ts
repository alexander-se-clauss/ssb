import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, inputOf, type PlayerInput } from '../core';
import type { InputSource } from '../ports';
import { OverridableInput } from './debug-input';

class FakeInput implements InputSource {
  samples = 0;
  constructor(private readonly input: PlayerInput) {}
  sample(): PlayerInput {
    this.samples += 1;
    return this.input;
  }
  dispose(): void {}
}

describe('overridable input for tests and agents', () => {
  it('passes the real input through until an override is set', () => {
    const keyboard = new FakeInput(inputOf({ attack: true }));
    const input = new OverridableInput(keyboard);
    expect(input.sample()).toEqual(inputOf({ attack: true }));
  });

  it('replaces the real input while overridden, and still drains it', () => {
    const keyboard = new FakeInput(inputOf({ attack: true }));
    const input = new OverridableInput(keyboard);
    input.override(inputOf({ x: -1 }));
    expect(input.sample()).toEqual(inputOf({ x: -1 }));
    expect(keyboard.samples).toBe(1);
    input.override(null);
    expect(input.sample()).toEqual(inputOf({ attack: true }));
  });

  it('is neutral when overridden with an empty input', () => {
    const input = new OverridableInput(new FakeInput(inputOf({ x: 1 })));
    input.override(NEUTRAL_INPUT);
    expect(input.sample()).toEqual(NEUTRAL_INPUT);
  });
});
