import { describe, expect, it } from 'vitest';
import type { AudioOutput } from '../../ports';
import { RecordingAudioOutput } from './recording-audio-output';

describe('RecordingAudioOutput', () => {
  it('records cues, tracks and volumes', () => {
    const audio = new RecordingAudioOutput();
    audio.play('menu-move');
    audio.play('hit', 0.8);
    audio.playMusic('menu');
    audio.playMusic('menu');
    audio.playMusic(null);
    audio.setVolume('music', 0.3);
    expect(audio.played).toEqual([
      { cue: 'menu-move', strength: undefined },
      { cue: 'hit', strength: 0.8 },
    ]);
    expect(audio.tracks).toEqual(['menu', null]);
    expect(audio.volumes).toEqual({ music: 0.3, effects: 1 });
  });

  it('keeps only the most recent cues, so a long session does not grow without end', () => {
    const audio = new RecordingAudioOutput(undefined, 3);
    for (const cue of ['jump', 'land', 'attack', 'hit'] as const) audio.play(cue);
    expect(audio.played.map((played) => played.cue)).toEqual(['land', 'attack', 'hit']);
    for (const track of ['menu', 'battlefield', 'results', 'menu']) audio.playMusic(track);
    expect(audio.tracks).toEqual(['battlefield', 'results', 'menu']);
  });

  it('passes everything on to the output it wraps', () => {
    const calls: string[] = [];
    const inner: AudioOutput = {
      play: (cue) => calls.push(`play ${cue}`),
      playMusic: (track) => calls.push(`music ${track}`),
      setVolume: (channel, volume) => calls.push(`${channel} ${volume}`),
      dispose: () => calls.push('dispose'),
    };
    const audio = new RecordingAudioOutput(inner);
    audio.play('ko');
    audio.playMusic('plateau');
    audio.setVolume('effects', 0.5);
    audio.dispose();
    expect(calls).toEqual(['play ko', 'music plateau', 'effects 0.5', 'dispose']);
  });
});
