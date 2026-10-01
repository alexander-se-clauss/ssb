import type { MusicTrack } from '../../ports';
import { arpeggio, drums, notes, type Song } from './music';

/** Kick on the beat, snare on two and four, hats on the eighths: one bar. */
const BACKBEAT = 'k.h.s.h.k.h.s.h.';
const DRIVE = 'k.hhs.hkk.hhs.hh';

/** The menus: calm and bright, C major (C, Am, F, G). */
const MENU: Song = {
  bpm: 104,
  length: 64,
  loop: true,
  voices: [
    {
      kind: 'tone',
      wave: 'triangle',
      gain: 0.35,
      noteSteps: 2,
      steps: notes(
        'C2 C3 C2 C3 C2 C3 G2 C3 A1 A2 A1 A2 A1 A2 E2 A2 F1 F2 F1 F2 F1 F2 C2 F2 G1 G2 G1 G2 G1 G2 D2 B1',
        2,
      ),
    },
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.04,
      noteSteps: 1,
      steps: arpeggio(['C4 E4 G4 E4', 'A3 C4 E4 C4', 'F3 A3 C4 A3', 'G3 B3 D4 B3']),
    },
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.07,
      noteSteps: 3,
      steps: notes(
        'E5 . G5 . A5 . G5 E5 C5 . E5 . D5 . C5 A4 . . C5 . A4 . F4 . G4 . B4 . D5 . . .',
        2,
      ),
    },
    { kind: 'drum', gain: 0.3, steps: drums('k.......s.......') },
  ],
};

/** Battlefield: driving, A minor (Am, F, C, G). */
const BATTLEFIELD: Song = {
  bpm: 150,
  length: 64,
  loop: true,
  voices: [
    {
      kind: 'tone',
      wave: 'sawtooth',
      gain: 0.12,
      noteSteps: 1,
      steps: notes(
        'A1 A2 A1 A2 A1 A2 G2 A2 F1 F2 F1 F2 F1 F2 E2 F2 C2 C3 C2 C3 C2 C3 B2 C3 G1 G2 G1 G2 G1 G2 B1 D2',
        2,
      ),
    },
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.07,
      noteSteps: 2,
      steps: notes(
        'A4 . C5 E5 . D5 C5 B4 A4 . C5 . F5 E5 D5 C5 E5 . G5 . E5 D5 C5 . D5 . B4 . G4 . B4 D5',
        2,
      ),
    },
    {
      kind: 'tone',
      wave: 'triangle',
      gain: 0.08,
      noteSteps: 1,
      steps: arpeggio(['A3 C4 E4 C4', 'F3 A3 C4 A3', 'C4 E4 G4 E4', 'G3 B3 D4 B3']),
    },
    { kind: 'drum', gain: 0.35, steps: drums(DRIVE) },
  ],
};

/** Final Destination: dark and dramatic, D minor (Dm, Bb, Gm, A). */
const FINAL_DESTINATION: Song = {
  bpm: 132,
  length: 64,
  loop: true,
  voices: [
    {
      kind: 'tone',
      wave: 'sawtooth',
      gain: 0.13,
      noteSteps: 2,
      steps: notes(
        'D2 D2 D3 D2 F2 D2 A2 D2 Bb1 Bb1 Bb2 Bb1 D2 Bb1 F2 Bb1 G1 G1 G2 G1 Bb1 G1 D2 G1 A1 A1 A2 A1 C#2 A1 E2 A1',
        2,
      ),
    },
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.07,
      noteSteps: 6,
      steps: notes(
        'D5 . . A4 . . F5 . E5 . . D5 . . Bb4 . G4 . . Bb4 . . D5 . E5 . . C#5 . . A4 .',
        2,
      ),
    },
    { kind: 'drum', gain: 0.35, steps: drums(BACKBEAT) },
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
