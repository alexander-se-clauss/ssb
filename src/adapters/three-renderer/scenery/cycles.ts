/**
 * The animated backgrounds as pure functions of time, so they can be tested without WebGL.
 * Time is in seconds of match time; the backgrounds loop forever.
 */

export type Rgb = readonly [number, number, number];

/** What the Battlefield sky looks like at one moment. */
export interface SkyLook {
  readonly zenith: Rgb;
  readonly horizon: Rgb;
  /** Light around the sun or moon. */
  readonly glow: Rgb;
  /** Lit side of the clouds. */
  readonly cloud: Rgb;
  /** 0 by day, 1 at full night. */
  readonly stars: number;
  /** Height of the sun above the horizon, -1..1. */
  readonly sunHeight: number;
}

/** Seconds for Battlefield's sky to go from day through sunset and night back to day. */
export const DAY_LENGTH = 120;

const rgb = (hex: number): Rgb => [
  ((hex >> 16) & 0xff) / 255,
  ((hex >> 8) & 0xff) / 255,
  (hex & 0xff) / 255,
];

/** Key moments of the day, evenly spaced over `DAY_LENGTH`, like Melee's Battlefield. */
const DAY: SkyLook = {
  zenith: rgb(0x2f6fc4),
  horizon: rgb(0xa9d2f2),
  glow: rgb(0xfff2c8),
  cloud: rgb(0xf4f7ff),
  stars: 0,
  sunHeight: 0.6,
};
const DAY_KEYS: readonly SkyLook[] = [
  DAY,
  {
    zenith: rgb(0x3b3a7a),
    horizon: rgb(0xf29a5c),
    glow: rgb(0xff8a3d),
    cloud: rgb(0xffc49a),
    stars: 0.1,
    sunHeight: 0.05,
  },
  {
    zenith: rgb(0x070b24),
    horizon: rgb(0x1d2a5a),
    glow: rgb(0x8fa8ff),
    cloud: rgb(0x46507e),
    stars: 1,
    sunHeight: -0.4,
  },
  {
    zenith: rgb(0x3a4f9a),
    horizon: rgb(0xe7a6b8),
    glow: rgb(0xffc0a0),
    cloud: rgb(0xf6cdd6),
    stars: 0.2,
    sunHeight: 0.1,
  },
];

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];

/** Each key holds for a while, then eases into the next. */
const HOLD = 0.45;

/** Where we are in a loop of `count` evenly spaced keys: the key, the next one and the blend. */
const loopKeys = (
  seconds: number,
  length: number,
  count: number,
): { from: number; to: number; t: number } => {
  const position = ((((seconds / length) % 1) + 1) % 1) * count;
  const from = Math.floor(position) % count;
  const local = position - Math.floor(position);
  const eased = local < HOLD ? 0 : (local - HOLD) / (1 - HOLD);
  return { from, to: (from + 1) % count, t: eased * eased * (3 - 2 * eased) };
};

export const skyAt = (seconds: number): SkyLook => {
  const { from, to, t } = loopKeys(seconds, DAY_LENGTH, DAY_KEYS.length);
  const a = DAY_KEYS[from] ?? DAY;
  const b = DAY_KEYS[to] ?? DAY;
  return {
    zenith: mixRgb(a.zenith, b.zenith, t),
    horizon: mixRgb(a.horizon, b.horizon, t),
    glow: mixRgb(a.glow, b.glow, t),
    cloud: mixRgb(a.cloud, b.cloud, t),
    stars: mix(a.stars, b.stars, t),
    sunHeight: mix(a.sunHeight, b.sunHeight, t),
  };
};

/** How much of each Final Destination backdrop shows; the weights add up to 1. */
export interface DestinationLook {
  /** Flying through a tunnel of light streaks. */
  readonly warp: number;
  /** Drifting through a coloured nebula. */
  readonly nebula: number;
  /** A planet with aurora above it. */
  readonly planet: number;
}

/** Seconds for Final Destination's backdrop to pass through all three scenes. */
export const DESTINATION_LENGTH = 90;

export const destinationAt = (seconds: number): DestinationLook => {
  const { from, to, t } = loopKeys(seconds, DESTINATION_LENGTH, 3);
  const weights = [0, 0, 0];
  weights[from] = 1 - t;
  weights[to] = (weights[to] ?? 0) + t;
  return { warp: weights[0] ?? 0, nebula: weights[1] ?? 0, planet: weights[2] ?? 0 };
};
