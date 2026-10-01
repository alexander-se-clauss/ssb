import { describe, expect, it } from 'vitest';
import { inputOf, type PlayerInput } from '../../core';
import type { InputSource } from '../../ports';
import { CombinedInput } from './combined-input';

const fixed = (input: PlayerInput): InputSource & { disposed: boolean } => ({
  disposed: false,
  sample: () => input,
  dispose() {
    this.disposed = true;
  },
});

describe('CombinedInput', () => {
  it('presses a button when any device presses it', () => {
    const input = new CombinedInput([
      fixed(inputOf({ attack: true })),
      fixed(inputOf({ jump: true })),
    ]);
    expect(input.sample()).toMatchObject({ attack: true, jump: true, special: false });
  });

  it('takes the stick that is pushed furthest on each axis', () => {
    const input = new CombinedInput([
      fixed(inputOf({ x: 0.4, y: -1 })),
      fixed(inputOf({ x: -0.9, y: 0.3 })),
    ]);
    expect(input.sample()).toMatchObject({ x: -0.9, y: -1 });
  });

  it('disposes every device', () => {
    const devices = [fixed(inputOf({})), fixed(inputOf({}))];
    new CombinedInput(devices).dispose();
    expect(devices.map((device) => device.disposed)).toEqual([true, true]);
  });
});
