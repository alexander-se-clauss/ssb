import { describe, expect, it } from 'vitest';
import { INITIAL_SCREEN, MAIN_MENU, SCREENS, canGo, go, nextScreens } from './screens';

describe('screen state machine', () => {
  it('boots into the title screen', () => {
    expect(INITIAL_SCREEN).toBe('title');
  });

  it('walks the whole menu flow and back to the menu', () => {
    const path = [
      'main-menu',
      'character-select',
      'stage-select',
      'match',
      'results',
      'main-menu',
    ] as const;
    let screen = INITIAL_SCREEN;
    for (const to of path) screen = go(screen, to);
    expect(screen).toBe('main-menu');
  });

  it('allows going back one step from every menu', () => {
    expect(canGo('main-menu', 'title')).toBe(true);
    expect(canGo('options', 'main-menu')).toBe(true);
    expect(canGo('controls', 'options')).toBe(true);
    expect(canGo('character-select', 'main-menu')).toBe(true);
    expect(canGo('stage-select', 'character-select')).toBe(true);
  });

  it('offers a rematch from results', () => {
    expect(canGo('results', 'match')).toBe(true);
  });

  it('rejects skipping screens', () => {
    expect(canGo('title', 'match')).toBe(false);
    expect(canGo('character-select', 'match')).toBe(false);
    expect(canGo('match', 'main-menu')).toBe(false);
    expect(() => go('title', 'results')).toThrow(/title -> results/);
  });

  it('can reach every screen from the title and never gets stuck', () => {
    const seen = new Set([INITIAL_SCREEN]);
    const queue = [INITIAL_SCREEN];
    for (let screen = queue.shift(); screen; screen = queue.shift()) {
      expect(nextScreens(screen).length).toBeGreaterThan(0);
      for (const next of nextScreens(screen)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...SCREENS].sort());
  });
});

describe('options', () => {
  it('leads to the controls screen', () => {
    expect(canGo('options', 'controls')).toBe(true);
  });

  it('leads to the sound screen and back', () => {
    expect(canGo('options', 'sound')).toBe(true);
    expect(canGo('sound', 'options')).toBe(true);
  });
});

describe('main menu', () => {
  it('offers VS. Mode and Options', () => {
    expect(MAIN_MENU.map((entry) => entry.label)).toEqual(['VS. Mode', 'Options']);
  });

  it('leads to character select and options', () => {
    expect(MAIN_MENU.map((entry) => entry.to)).toEqual(['character-select', 'options']);
    for (const entry of MAIN_MENU) expect(canGo('main-menu', entry.to)).toBe(true);
  });
});
