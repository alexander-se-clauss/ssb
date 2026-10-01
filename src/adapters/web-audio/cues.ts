import type { SoundCue } from '../../ports';

/**
 * One synthesized layer of a cue: an oscillator (or filtered noise) gliding from one pitch to
 * another with a fast attack and an exponential fade. Times in seconds, pitches in Hz.
 */
export interface Tone {
  readonly wave: Exclude<OscillatorType, 'custom'> | 'noise';
  /** Start and end pitch; for noise, the centre of its band-pass filter. */
  readonly from: number;
  readonly to: number;
  /** Delay after the cue starts. */
  readonly at: number;
  readonly duration: number;
  /** Peak level, 0 to 1, before the effects volume. */
  readonly gain: number;
}

const blip = (from: number, to: number, duration: number, gain = 0.25, at = 0): Tone => ({
  wave: 'square',
  from,
  to,
  at,
  duration,
  gain,
});

/** The sound of each cue, as data. Fight cues get their final shape in `shapeCue`. */
export const CUES: Readonly<Record<SoundCue, readonly Tone[]>> = {
  'menu-move': [blip(880, 880, 0.04, 0.12)],
  'menu-confirm': [blip(660, 660, 0.05), blip(990, 990, 0.08, 0.25, 0.05)],
  'menu-back': [blip(520, 520, 0.05), blip(350, 350, 0.08, 0.25, 0.05)],
  'menu-adjust': [blip(740, 740, 0.03, 0.12)],
  join: [blip(440, 880, 0.12, 0.2)],
  leave: [blip(660, 330, 0.12, 0.2)],
  pick: [blip(784, 784, 0.05, 0.2), blip(1175, 1175, 0.1, 0.2, 0.05)],
  'match-start': [
    blip(523, 523, 0.1, 0.22),
    blip(659, 659, 0.1, 0.22, 0.1),
    blip(784, 784, 0.1, 0.22, 0.2),
    blip(1047, 1047, 0.3, 0.22, 0.3),
  ],
  attack: [{ wave: 'noise', from: 900, to: 2400, at: 0, duration: 0.12, gain: 0.35 }],
  jump: [{ wave: 'triangle', from: 300, to: 700, at: 0, duration: 0.1, gain: 0.3 }],
  land: [{ wave: 'noise', from: 300, to: 150, at: 0, duration: 0.06, gain: 0.3 }],
  hit: [
    { wave: 'noise', from: 1800, to: 500, at: 0, duration: 0.12, gain: 0.6 },
    { wave: 'sine', from: 180, to: 60, at: 0, duration: 0.15, gain: 0.7 },
  ],
  ko: [
    { wave: 'noise', from: 2500, to: 200, at: 0, duration: 0.7, gain: 0.7 },
    { wave: 'sawtooth', from: 220, to: 40, at: 0, duration: 0.6, gain: 0.35 },
  ],
  'match-end': [
    blip(784, 784, 0.15, 0.22),
    blip(659, 659, 0.15, 0.22, 0.15),
    blip(523, 523, 0.4, 0.22, 0.3),
  ],
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Cues whose weight follows `strength`; the others always sound the same. */
const VARYING: ReadonlySet<SoundCue> = new Set(['attack', 'land', 'hit', 'ko']);

/**
 * The tones to play for `cue`. For fight cues, `strength` (0 to 1) makes the cue heavier: louder,
 * lower and a little longer, so a strong hit sounds like one. Cues are designed at 0.5.
 */
export const shapeCue = (cue: SoundCue, strength = 0.5): readonly Tone[] => {
  if (!VARYING.has(cue)) return CUES[cue];
  const s = clamp01(strength);
  const loudness = 0.6 + 0.8 * s;
  const pitch = 1.3 - 0.6 * s;
  const length = 0.8 + 0.4 * s;
  return CUES[cue].map((tone) => ({
    ...tone,
    from: tone.from * pitch,
    to: tone.to * pitch,
    duration: tone.duration * length,
    gain: clamp01(tone.gain * loudness),
  }));
};
