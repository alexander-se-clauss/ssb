/**
 * Every sound effect the game can ask for, by what happened rather than how it sounds. The
 * adapter decides the sound, so a synthesized cue can become a recorded sample without touching
 * callers.
 */
export type SoundCue =
  // Menus
  | 'menu-move'
  | 'menu-confirm'
  | 'menu-back'
  | 'menu-adjust'
  | 'join'
  | 'leave'
  | 'pick'
  | 'match-start'
  // Fights
  | 'attack'
  | 'jump'
  | 'land'
  | 'hit'
  | 'ko'
  | 'match-end';

/** A music track id: `menu`, a stage id, or `results`. */
export type MusicTrack = string;

/** Volumes are set per channel. */
export type AudioChannel = 'music' | 'effects';

/**
 * Plays sound effects and background music. Audio is presentation only: nothing the game
 * decides may depend on it, so it never reports back.
 */
export interface AudioOutput {
  /** Plays a cue once. `strength` from 0 to 1 scales cues that vary, like a hit's weight. */
  play(cue: SoundCue, strength?: number): void;
  /**
   * Switches the music to `track` (most loop, a jingle plays once), or fades it out with `null`.
   * The same track again changes nothing.
   */
  playMusic(track: MusicTrack | null): void;
  /** `volume` from 0 (silent) to 1 (full). */
  setVolume(channel: AudioChannel, volume: number): void;
  dispose(): void;
}
