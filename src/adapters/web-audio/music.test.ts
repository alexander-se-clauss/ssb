import { describe, expect, it } from 'vitest';
import { STAGES } from '../../core';
import {
  arpeggio,
  drums,
  frequency,
  midi,
  noteTone,
  notes,
  notesBetween,
  stepSeconds,
  type Song,
} from './music';
import { SONGS, songFor } from './songs';

describe('music notation', () => {
  it('reads note names as MIDI numbers', () => {
    expect(midi('C4')).toBe(60);
    expect(midi('A4')).toBe(69);
    expect(midi('C#2')).toBe(37);
    expect(midi('Bb1')).toBe(34);
    expect(frequency(69)).toBeCloseTo(440);
    expect(() => midi('H2')).toThrow();
  });

  it('spreads each token over its steps', () => {
    expect(notes('C4 . E4', 2)).toEqual([60, null, null, null, 64, null]);
    expect(arpeggio(['C4 E4'], 3)).toEqual([60, 64, 60]);
    expect(drums('k.s h')).toEqual(['kick', null, 'snare', 'hat']);
  });
});

describe('notesBetween', () => {
  const song: Song = {
    bpm: 120,
    length: 4,
    loop: true,
    voices: [{ kind: 'tone', wave: 'square', gain: 1, noteSteps: 1, steps: [60, null] }],
  };

  it('repeats a short voice across the song and loops forever', () => {
    expect(notesBetween(song, 0, 8).map((n) => n.step)).toEqual([0, 2, 4, 6]);
    expect(notesBetween(song, 3, 5).map((n) => n.step)).toEqual([4]);
  });

  it('turns notes into tones that fit their steps', () => {
    const [note] = notesBetween(song, 0, 1);
    if (!note) throw new Error('no note');
    const tone = noteTone(note, 120);
    expect(tone.from).toBeCloseTo(frequency(60));
    expect(tone.duration).toBeLessThan(stepSeconds(120));
    const drum = noteTone(
      { kind: 'drum', step: 0, voice: { kind: 'drum', gain: 0.5, steps: [] }, note: 'kick' },
      120,
    );
    expect(drum.gain).toBe(0.5);
  });

  it('plays a jingle once', () => {
    expect(notesBetween({ ...song, loop: false }, 0, 8).map((n) => n.step)).toEqual([0, 2]);
  });
});

describe('songs', () => {
  it('has a menu theme, a results jingle and a track for every stage', () => {
    expect(SONGS['menu']?.loop).toBe(true);
    expect(SONGS['results']?.loop).toBe(false);
    for (const stage of STAGES) expect(SONGS[stage.id], stage.id).toBeDefined();
    expect(songFor('no-such-stage')).toBe(SONGS['battlefield']);
  });

  it('fills every voice to whole bars that fit the song', () => {
    for (const [id, song] of Object.entries(SONGS)) {
      for (const voice of song.voices) {
        expect(voice.steps.length % 16, id).toBe(0);
        expect(song.length % voice.steps.length, id).toBe(0);
      }
    }
  });
});
