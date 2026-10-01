/**
 * Music as plain data: a song is a few looping voices on a grid of sixteenth-note steps, played
 * by a small step sequencer in `WebAudioOutput`. Helpers here write patterns compactly and turn
 * them into notes; they are pure so the songs can be tested without audio.
 */
import type { Tone } from './cues';

export type Drum = 'kick' | 'snare' | 'hat';

/** A pitched voice: a MIDI note or null (nothing new) per step. */
export interface ToneVoice {
  readonly kind: 'tone';
  readonly wave: 'sine' | 'square' | 'sawtooth' | 'triangle';
  readonly gain: number;
  /** How long each note sounds, in steps. */
  readonly noteSteps: number;
  readonly steps: readonly (number | null)[];
}

/** A drum voice: a drum hit or null per step. */
export interface DrumVoice {
  readonly kind: 'drum';
  readonly gain: number;
  readonly steps: readonly (Drum | null)[];
}

export type Voice = ToneVoice | DrumVoice;

export interface Song {
  readonly bpm: number;
  /** Steps in one pass; voices shorter than this repeat. */
  readonly length: number;
  /** Loops forever, or plays once (a jingle). */
  readonly loop: boolean;
  readonly voices: readonly Voice[];
}

/** One note to play: when (in steps from the song's start), what and for how long. */
export type ScheduledNote =
  | {
      readonly kind: 'tone';
      readonly step: number;
      readonly voice: ToneVoice;
      readonly note: number;
    }
  | {
      readonly kind: 'drum';
      readonly step: number;
      readonly voice: DrumVoice;
      readonly note: Drum;
    };

const NOTE_OFFSETS: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** MIDI number of a note name such as `C4`, `F#3` or `Bb2` (C4 = 60). */
export const midi = (name: string): number => {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const offset = match?.[1] === undefined ? undefined : NOTE_OFFSETS[match[1]];
  if (!match || offset === undefined) throw new Error(`Not a note: ${name}`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return 12 * (Number(match[3]) + 1) + offset + accidental;
};

/** Frequency in Hz of a MIDI note (A4 = 440 Hz). */
export const frequency = (note: number): number => 440 * 2 ** ((note - 69) / 12);

/** Seconds per step (a sixteenth note). */
export const stepSeconds = (bpm: number): number => 60 / bpm / 4;

/**
 * A pattern from space-separated tokens, each `per` steps long: a note name starts a note, `.`
 * leaves the step empty. `notes('C4 . E4 G4', 4)` is four quarter notes, the second silent.
 */
export const notes = (pattern: string, per = 1): (number | null)[] =>
  pattern
    .trim()
    .split(/\s+/)
    .flatMap((token) => [token === '.' ? null : midi(token), ...Array<null>(per - 1).fill(null)]);

/** Each chord's tones cycled as sixteenths for `steps` steps, chord after chord. */
export const arpeggio = (chords: readonly string[], steps = 16): (number | null)[] =>
  chords.flatMap((chord) => {
    const tones = chord.split(' ').map(midi);
    return Array.from({ length: steps }, (_, i) => tones[i % tones.length] ?? null);
  });

const DRUM_TOKENS: Readonly<Record<string, Drum>> = { k: 'kick', s: 'snare', h: 'hat' };

/** A drum pattern: one character per step, `k` kick, `s` snare, `h` hat, `.` nothing. */
export const drums = (pattern: string): (Drum | null)[] =>
  [...pattern.replace(/\s/g, '')].map((char) => DRUM_TOKENS[char] ?? null);

/**
 * The notes that start in steps `from` (inclusive) to `to` (exclusive), counted from the song's
 * start. A looping song repeats each voice forever; a jingle plays its length once.
 */
export const notesBetween = (song: Song, from: number, to: number): ScheduledNote[] => {
  const scheduled: ScheduledNote[] = [];
  const end = song.loop ? to : Math.min(to, song.length);
  for (let step = Math.max(0, from); step < end; step += 1) {
    for (const voice of song.voices) {
      if (voice.steps.length === 0) continue;
      if (voice.kind === 'drum') {
        const note = voice.steps[step % voice.steps.length];
        if (note != null) scheduled.push({ kind: 'drum', step, voice, note });
      } else {
        const note = voice.steps[step % voice.steps.length];
        if (note != null) scheduled.push({ kind: 'tone', step, voice, note });
      }
    }
  }
  return scheduled;
};

/** Each drum as a synthesized tone, at full voice gain. */
const DRUM_TONES: Readonly<Record<Drum, Tone>> = {
  kick: { wave: 'sine', from: 150, to: 40, at: 0, duration: 0.15, gain: 1 },
  snare: { wave: 'noise', from: 1800, to: 1200, at: 0, duration: 0.12, gain: 0.6 },
  hat: { wave: 'noise', from: 8000, to: 8000, at: 0, duration: 0.04, gain: 0.3 },
};

/** Share of a note's steps it sounds for, so repeated notes stay apart. */
const NOTE_LENGTH = 0.9;

/** How a scheduled note sounds, as a tone for the synthesizer. */
export const noteTone = (scheduled: ScheduledNote, bpm: number): Tone => {
  if (scheduled.kind === 'drum') {
    const drum = DRUM_TONES[scheduled.note];
    return { ...drum, gain: drum.gain * scheduled.voice.gain };
  }
  const { voice } = scheduled;
  const hz = frequency(scheduled.note);
  return {
    wave: voice.wave,
    from: hz,
    to: hz,
    at: 0,
    duration: voice.noteSteps * stepSeconds(bpm) * NOTE_LENGTH,
    gain: voice.gain,
  };
};
