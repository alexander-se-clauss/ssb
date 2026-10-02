import { describe, expect, it } from 'vitest';
import { LastDevice, menuPrompts } from './button-prompts';

const pick = { label: 'VS. Mode', select: () => undefined };
const setting = { label: 'Music: 7', select: () => undefined, adjust: () => undefined };

describe('menuPrompts', () => {
  it('names the keys that work on a keyboard', () => {
    expect(menuPrompts({ options: [pick], back: () => undefined }, 'keyboard')).toEqual([
      { button: 'Enter', action: 'Select' },
      { button: 'Esc', action: 'Back' },
    ]);
  });

  it('names gamepad buttons as in Melee: A picks, B goes back', () => {
    expect(menuPrompts({ options: [pick], back: () => undefined }, 'gamepad')).toEqual([
      { button: 'A', action: 'Select' },
      { button: 'B', action: 'Back' },
    ]);
  });

  it('adds Change when a row holds a setting', () => {
    expect(menuPrompts({ options: [setting], back: () => undefined }, 'gamepad')).toEqual([
      { button: 'A', action: 'Select' },
      { button: '◀▶', action: 'Change' },
      { button: 'B', action: 'Back' },
    ]);
    expect(menuPrompts({ options: [setting] }, 'keyboard')).toContainEqual({
      button: '←→',
      action: 'Change',
    });
  });

  it('offers Start on a screen without options, such as the title', () => {
    expect(menuPrompts({ start: () => undefined }, 'gamepad')).toEqual([
      { button: 'A', action: 'Start' },
    ]);
  });

  it('shows nothing on a screen with no options, start or back', () => {
    expect(menuPrompts({}, 'keyboard')).toEqual([]);
  });

  it('shows only Back when going back is all a screen offers', () => {
    expect(menuPrompts({ back: () => undefined }, 'keyboard')).toEqual([
      { button: 'Esc', action: 'Back' },
    ]);
  });
});

describe('LastDevice', () => {
  it('starts on the keyboard and tells listeners only about real changes', () => {
    const device = new LastDevice();
    const seen: string[] = [];
    device.onChange(() => seen.push(device.kind));
    expect(device.kind).toBe('keyboard');
    device.use('keyboard');
    device.use('gamepad');
    device.use('gamepad');
    device.use('keyboard');
    expect(seen).toEqual(['gamepad', 'keyboard']);
  });
});
