import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUDIO_SETTINGS,
  MAX_VOLUME,
  adjustVolume,
  loadAudioSettings,
  saveAudioSettings,
  volumeLevel,
  type SettingsStore,
} from './audio-settings';

const memoryStore = (
  initial: Record<string, string> = {},
): SettingsStore & {
  items: Record<string, string>;
} => {
  const items = { ...initial };
  return {
    items,
    getItem: (key) => items[key] ?? null,
    setItem: (key, value) => {
      items[key] = value;
    },
  };
};

describe('audio settings', () => {
  it('steps a volume by one and stays within 0 and 10', () => {
    expect(adjustVolume({ music: 5, effects: 5 }, 'music', 1)).toEqual({ music: 6, effects: 5 });
    expect(adjustVolume({ music: 0, effects: 5 }, 'music', -1).music).toBe(0);
    expect(adjustVolume({ music: 5, effects: MAX_VOLUME }, 'effects', 1).effects).toBe(MAX_VOLUME);
  });

  it('turns a setting into a gain between 0 and 1', () => {
    expect(volumeLevel(0)).toBe(0);
    expect(volumeLevel(MAX_VOLUME)).toBe(1);
    expect(volumeLevel(5)).toBeGreaterThan(0);
    expect(volumeLevel(5)).toBeLessThan(0.5);
  });

  it('remembers the settings across visits', () => {
    const store = memoryStore();
    saveAudioSettings(store, { music: 3, effects: 9 });
    expect(loadAudioSettings(store)).toEqual({ music: 3, effects: 9 });
  });

  it('uses the defaults when nothing or something broken was saved', () => {
    expect(loadAudioSettings(memoryStore())).toEqual(DEFAULT_AUDIO_SETTINGS);
    const broken = memoryStore({ 'ssb.audio': '{not json' });
    expect(loadAudioSettings(broken)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('keeps saved values in range and fills in missing ones', () => {
    const store = memoryStore({ 'ssb.audio': JSON.stringify({ music: 42, effects: 'loud' }) });
    expect(loadAudioSettings(store)).toEqual({
      music: MAX_VOLUME,
      effects: DEFAULT_AUDIO_SETTINGS.effects,
    });
  });

  it('carries on when the browser refuses storage', () => {
    const refusing: SettingsStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadAudioSettings(refusing)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(() => saveAudioSettings(refusing, DEFAULT_AUDIO_SETTINGS)).not.toThrow();
  });
});
