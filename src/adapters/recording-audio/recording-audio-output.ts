import type { AudioChannel, AudioOutput, MusicTrack, SoundCue } from '../../ports';

/** One cue as it was asked for. */
export interface PlayedCue {
  readonly cue: SoundCue;
  readonly strength: number | undefined;
}

/**
 * Remembers what was played and passes it on to `inner`, if any. Without `inner` it is silent,
 * so tests can check which sounds an action triggers without listening.
 */
export class RecordingAudioOutput implements AudioOutput {
  readonly played: PlayedCue[] = [];
  readonly tracks: (MusicTrack | null)[] = [];
  readonly volumes: Record<AudioChannel, number> = { music: 1, effects: 1 };

  constructor(private readonly inner?: AudioOutput) {}

  play(cue: SoundCue, strength?: number): void {
    this.played.push({ cue, strength });
    this.inner?.play(cue, strength);
  }

  playMusic(track: MusicTrack | null): void {
    if (this.tracks.at(-1) !== track) this.tracks.push(track);
    this.inner?.playMusic(track);
  }

  setVolume(channel: AudioChannel, volume: number): void {
    this.volumes[channel] = volume;
    this.inner?.setVolume(channel, volume);
  }

  dispose(): void {
    this.inner?.dispose();
  }
}
