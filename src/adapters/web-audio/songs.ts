import type { MusicTrack } from '../../ports';
import { arpeggio, drums, notes, type Song } from './music';

/** A note name one octave up: `C2` to `C3`. */
const octaveUp = (note: string): string =>
  note.replace(/-?\d$/, (octave) => `${Number(octave) + 1}`);

/** A pumping eighth-note bass: each root and its octave, four times, for one bar per root. */
const pump = (roots: string): string =>
  roots
    .trim()
    .split(/\s+/)
    .map((root) =>
      Array<string>(4)
        .fill(`${root} ${octaveUp(root)}`)
        .join(' '),
    )
    .join(' ');

/** The menus: fast and driving, E minor (Em, C, G, D). */
const MENU: Song = {
  bpm: 168,
  length: 64,
  loop: true,
  voices: [
    {
      kind: 'tone',
      wave: 'sawtooth',
      gain: 0.1,
      noteSteps: 1,
      steps: notes(
        'E2 E3 E2 E3 E2 E3 E2 D3 C2 C3 C2 C3 C2 C3 C2 B2 G1 G2 G1 G2 G1 G2 G1 A2 D2 D3 D2 D3 D2 D3 F#2 D#2',
        2,
      ),
    },
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.035,
      noteSteps: 1,
      steps: arpeggio(['E4 G4 B4 G4', 'C4 E4 G4 E4', 'G3 B3 D4 B3', 'D4 F#4 A4 F#4']),
    },
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.07,
      noteSteps: 2,
      steps: notes(
        'B4 . E5 . G5 F#5 E5 . G5 . E5 . C5 . E5 . D5 . . B4 . D5 G5 . F#5 . . . A5 . F#5 .',
        2,
      ),
    },
    { kind: 'drum', gain: 0.32, steps: drums('k.hhs.hhk.hks.hh') },
  ],
};

/** Battlefield: heroic, a bright march with a brass-like fanfare, C major (C, G, Am, F). */
const BATTLEFIELD: Song = {
  bpm: 144,
  length: 128,
  loop: true,
  voices: [
    {
      kind: 'tone',
      wave: 'triangle',
      gain: 0.32,
      noteSteps: 1,
      steps: notes(pump('C2 G1 A1 F1 C2 G1 F1 G1'), 2),
    },
    {
      kind: 'tone',
      wave: 'sawtooth',
      gain: 0.06,
      noteSteps: 3,
      steps: notes(
        `C5 . . G4 C5 . E5 .  D5 . . B4 G4 . . .  C5 . . E5 A5 . G5 .  F5 . E5 . C5 . . .
         E5 . . G5 C6 . . .  B5 . A5 . G5 . D5 .  A5 . G5 . F5 . A5 .  G5 . . . D5 . B4 .`,
        2,
      ),
    },
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.035,
      noteSteps: 15,
      steps: notes('E4 D4 E4 F4 E4 D4 C4 D4', 16),
    },
    { kind: 'drum', gain: 0.34, steps: drums('k.h.s.hkk.h.s.h. k.h.s.hkk.hss.ss') },
  ],
};

/** Final Destination: epic, a pounding string ostinato under a soaring theme, D minor. */
const FINAL_DESTINATION: Song = {
  bpm: 126,
  length: 128,
  loop: true,
  voices: [
    {
      kind: 'tone',
      wave: 'sawtooth',
      gain: 0.06,
      noteSteps: 1,
      steps: arpeggio([
        'D3 A3 D4 A3',
        'Bb2 F3 Bb3 F3',
        'C3 G3 C4 G3',
        'D3 A3 D4 A3',
        'D3 A3 D4 A3',
        'Bb2 F3 Bb3 F3',
        'G2 D3 G3 D3',
        'A2 E3 A3 C#4',
      ]),
    },
    {
      kind: 'tone',
      wave: 'triangle',
      gain: 0.4,
      noteSteps: 8,
      steps: notes('D2 D2 Bb1 Bb1 C2 C2 D2 D2 D2 D2 Bb1 Bb1 G1 G1 A1 A1', 8),
    },
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.07,
      noteSteps: 7,
      steps: notes(
        `D5 . . . . . A4 .  F5 . . . D5 . . .  E5 . . . G5 . F5 E5  D5 . . . . . . .
         A5 . . . . . F5 .  Bb5 . . . A5 . F5 .  G5 . . . Bb5 . D6 .  C#6 . . . A5 . E5 .`,
        2,
      ),
    },
    { kind: 'drum', gain: 0.38, steps: drums('k..hk.s.k.hkk.s. k..hk.s.k.hkksss') },
  ],
};

/** The results screen: a short fanfare, played once. */
const RESULTS: Song = {
  bpm: 120,
  length: 32,
  loop: false,
  voices: [
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.08,
      noteSteps: 2,
      steps: notes('C5 C5 C5 . C5 . G4 . A4 . . . C5 . . . E5 . . . . . . . . . . . . . . .'),
    },
    {
      kind: 'tone',
      wave: 'triangle',
      gain: 0.3,
      noteSteps: 4,
      steps: notes('C3 . . . F2 . G2 . C3 . . . . . . .', 2),
    },
    { kind: 'drum', gain: 0.3, steps: drums('k...k...k...s...k...............') },
  ],
};

/** Every track by id: `menu`, `results`, and one per stage id. */
export const SONGS: Readonly<Record<MusicTrack, Song>> = {
  menu: MENU,
  results: RESULTS,
  battlefield: BATTLEFIELD,
  'final-destination': FINAL_DESTINATION,
};

/** The song for a track; a stage without its own track plays Battlefield's. */
export const songFor = (track: MusicTrack): Song => SONGS[track] ?? BATTLEFIELD;
