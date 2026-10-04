/**
 * Cosmetic particles (#47), without Three.js so they can be tested: each effect id core names
 * (`activeEffects`, a spawned object's `effect`) has a preset here, and a pool of particles per
 * preset that the view emits into and steps by elapsed game frames. Nothing here feeds back into
 * the game.
 */

/** How one effect looks and moves. Speeds in stage units per game frame. */
export interface EffectPreset {
  /** Particles emitted per game frame while the effect is on. */
  readonly rate: number;
  /** Frames a particle lives. */
  readonly life: number;
  /** Random scatter around the emitter, in stage units. */
  readonly jitter: number;
  /** Random start speed in any direction, at most this. */
  readonly spread: number;
  /** Start speed straight up (negative falls). */
  readonly lift: number;
  /** Upward acceleration per frame; negative is gravity. */
  readonly rise: number;
  /** Speed kept per frame, 0..1. */
  readonly drag: number;
  /** Particle size in stage units. */
  readonly size: number;
  /** Colour when born and when gone, as 0xrrggbb; it fades out on the way. */
  readonly colors: readonly [number, number];
  /** Opacity when born, 0..1. */
  readonly opacity: number;
  /** Most particles alive at once; the oldest make room for new ones. */
  readonly capacity: number;
}

/** Every effect the game knows by id. Core's move data may only name these (tested). */
export const EFFECTS: Readonly<Record<string, EffectPreset>> = {
  // Licking flames: rising quickly, bright orange at the source, cooling to deep red.
  fire: {
    rate: 30,
    life: 20,
    jitter: 0.15,
    spread: 0.03,
    lift: 0.05,
    rise: 0.004,
    drag: 0.9,
    size: 0.45,
    colors: [0xffd04a, 0xd02a08],
    opacity: 0.95,
    capacity: 600,
  },
  // Vela's Pulse Shot (#53): a cyan plasma trail that cools to deep blue.
  plasma: {
    rate: 24,
    life: 14,
    jitter: 0.1,
    spread: 0.02,
    lift: 0,
    rise: 0,
    drag: 0.88,
    size: 0.55,
    colors: [0x7ff7e8, 0x1238c8],
    opacity: 0.95,
    capacity: 400,
  },
  // Hit sparks (#48): a quick spray of hot yellow sparks, reddening as they fall and die.
  spark: {
    rate: 0,
    life: 12,
    jitter: 0.08,
    spread: 0.16,
    lift: 0.02,
    rise: -0.006,
    drag: 0.84,
    size: 0.5,
    colors: [0xfff08a, 0xe02800],
    opacity: 1,
    capacity: 500,
  },
  // Block shards (#50): quick, cold blue-white flecks thrown off the guard.
  guard: {
    rate: 0,
    life: 14,
    jitter: 0.12,
    spread: 0.14,
    lift: 0.01,
    rise: -0.004,
    drag: 0.82,
    size: 0.42,
    colors: [0xe8fbff, 0x2f7dff],
    opacity: 1,
    capacity: 300,
  },
  // A counter flash (#51): a ring of hot gold that hangs a moment, then fades.
  counter: {
    rate: 0,
    life: 20,
    jitter: 0.2,
    spread: 0.12,
    lift: 0,
    rise: 0,
    drag: 0.86,
    size: 0.55,
    colors: [0xfff4b0, 0xffa400],
    opacity: 1,
    capacity: 300,
  },
  // Dash and landing dust (#151): a soft grey puff that drifts up a little and fades.
  dust: {
    rate: 0,
    life: 28,
    jitter: 0.2,
    spread: 0.08,
    lift: 0.03,
    rise: -0.001,
    drag: 0.86,
    size: 0.9,
    colors: [0xfffaf0, 0xa89f8e],
    opacity: 0.9,
    capacity: 400,
  },
  // A KO burst (#48): a big, slow-fading blast of light where a fighter left the blast zone.
  ko: {
    rate: 0,
    life: 40,
    jitter: 0.6,
    spread: 0.45,
    lift: 0,
    rise: 0,
    drag: 0.9,
    size: 1.1,
    colors: [0xffffff, 0xff5a1e],
    opacity: 1,
    capacity: 400,
  },
};

export const hasEffect = (id: string): boolean => Object.hasOwn(EFFECTS, id);

/** One 0..1 channel of a blend of two 0xrrggbb colours. */
const channel = (from: number, to: number, shift: number, t: number): number => {
  const a = (from >> shift) & 0xff;
  const b = (to >> shift) & 0xff;
  return (a + (b - a) * t) / 255;
};

/**
 * The particles of one preset, in fixed arrays (no garbage while playing). Dead particles have
 * `age >= life`. Randomness comes from `random`, so a seeded one gives the same picture each time.
 */
export class ParticlePool {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly age: Float32Array;
  /** Where the next particle goes: the oldest slot once the pool is full. */
  private next = 0;
  /** Fractions of a particle owed by emitters, so a slow rate still emits on time. */
  private owed = 0;

  constructor(
    readonly preset: EffectPreset,
    private readonly random: () => number,
  ) {
    const { capacity, life } = preset;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.age = new Float32Array(capacity).fill(life);
  }

  /** Emits what `frames` of the effect at (x, y), `depth` towards the camera, give off. */
  emitFor(x: number, y: number, depth: number, frames: number): void {
    this.owed += this.preset.rate * frames;
    const count = Math.floor(this.owed);
    this.owed -= count;
    this.emit(x, y, depth, count);
  }

  /** Emits `count` particles at (x, y); `power` scales how fast they fly out. */
  emit(x: number, y: number, depth: number, count: number, power = 1): void {
    const { jitter, lift, capacity } = this.preset;
    const spread = this.preset.spread * power;
    for (let i = 0; i < count; i += 1) {
      const slot = this.next;
      this.next = (this.next + 1) % capacity;
      const angle = this.random() * Math.PI * 2;
      const reach = Math.sqrt(this.random());
      this.x[slot] = x + Math.cos(angle) * jitter * reach;
      this.y[slot] = y + Math.sin(angle) * jitter * reach;
      this.z[slot] = depth + (this.random() - 0.5) * jitter;
      const speed = this.random() * spread;
      const heading = this.random() * Math.PI * 2;
      this.vx[slot] = Math.cos(heading) * speed;
      this.vy[slot] = Math.sin(heading) * speed + lift;
      this.age[slot] = 0;
    }
  }

  /** Moves and ages every particle by `frames` game frames (fractions allowed; 0 holds still). */
  step(frames: number): void {
    if (frames <= 0) return;
    const { rise, drag, life } = this.preset;
    const keep = drag ** frames;
    for (let i = 0; i < this.preset.capacity; i += 1) {
      const age = this.age[i] ?? life;
      if (age >= life) continue;
      const vy = (this.vy[i] ?? 0) * keep + rise * frames;
      const vx = (this.vx[i] ?? 0) * keep;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.x[i] = (this.x[i] ?? 0) + vx * frames;
      this.y[i] = (this.y[i] ?? 0) + vy * frames;
      this.age[i] = age + frames;
    }
  }

  alive(index: number): boolean {
    return (this.age[index] ?? this.preset.life) < this.preset.life;
  }

  get aliveCount(): number {
    let count = 0;
    for (let i = 0; i < this.preset.capacity; i += 1) if (this.alive(i)) count += 1;
    return count;
  }

  /**
   * Writes the particle's colour and opacity now (0..1 channels, fully clear when dead) into
   * `out` at `offset`, without allocating: the view calls it for every slot on every frame.
   */
  writeColor(index: number, out: Float32Array, offset: number): void {
    if (!this.alive(index)) {
      out.fill(0, offset, offset + 4);
      return;
    }
    const t = (this.age[index] ?? 0) / this.preset.life;
    const [from, to] = this.preset.colors;
    out[offset] = channel(from, to, 16, t);
    out[offset + 1] = channel(from, to, 8, t);
    out[offset + 2] = channel(from, to, 0, t);
    out[offset + 3] = (1 - t) * this.preset.opacity;
  }
}
