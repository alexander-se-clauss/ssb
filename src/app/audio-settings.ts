import type { AudioChannel } from '../ports';

/** The Music and Effects volumes in Options, each from 0 (off) to `MAX_VOLUME`. */
export type AudioSettings = Readonly<Record<AudioChannel, number>>;

export const MAX_VOLUME = 10;

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { music: 7, effects: 8 };

/** Where settings are kept between visits: `localStorage` in the browser. */
export type SettingsStore = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'ssb.audio';

const clampVolume = (volume: number): number =>
  Math.min(MAX_VOLUME, Math.max(0, Math.round(volume)));

/** The settings after pressing left (-1) or right (+1) on one volume row. */
export const adjustVolume = (
  settings: AudioSettings,
  channel: AudioChannel,
  delta: 1 | -1,
): AudioSettings => ({ ...settings, [channel]: clampVolume(settings[channel] + delta) });

/**
 * The gain for a volume setting. Ears hear loudness roughly logarithmically, so a square curve
 * makes each step sound about as big as the last.
 */
export const volumeLevel = (volume: number): number => (clampVolume(volume) / MAX_VOLUME) ** 2;

/** The saved settings, or the defaults for anything missing, broken or unreadable. */
export const loadAudioSettings = (store: SettingsStore): AudioSettings => {
  let saved: unknown;
  try {
    saved = JSON.parse(store.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    // Storage can be blocked (private mode, site settings) or hold something else.
    return DEFAULT_AUDIO_SETTINGS;
  }
  const read = (channel: AudioChannel): number => {
    const value: unknown =
      typeof saved === 'object' && saved !== null
        ? (saved as Record<string, unknown>)[channel]
        : undefined;
    return typeof value === 'number' && Number.isFinite(value)
      ? clampVolume(value)
      : DEFAULT_AUDIO_SETTINGS[channel];
  };
  return { music: read('music'), effects: read('effects') };
};

/** Saves the settings; the game carries on with them if the browser refuses. */
export const saveAudioSettings = (store: SettingsStore, settings: AudioSettings): void => {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not saved this time; the settings still apply until the page is closed.
  }
};
