/**
 * Fixed-timestep accumulator ("fix your timestep"). The display may run at 30, 60 or 144 Hz;
 * the simulation always advances in whole ticks of `tickMs`, which keeps it deterministic.
 */
export class FixedStepClock {
  private accumulator = 0;
  private lastTime: number | null = null;

  constructor(
    private readonly tickMs: number,
    /** Upper bound per update, so a background tab does not trigger thousands of catch-up ticks. */
    private readonly maxTicksPerUpdate = 5,
  ) {}

  /** Returns how many ticks to simulate for the given wall-clock time. */
  advance(nowMs: number): number {
    if (this.lastTime === null) {
      this.lastTime = nowMs;
      return 0;
    }
    this.accumulator += Math.max(0, nowMs - this.lastTime);
    this.lastTime = nowMs;

    const ticks = Math.min(Math.floor(this.accumulator / this.tickMs), this.maxTicksPerUpdate);
    this.accumulator =
      ticks === this.maxTicksPerUpdate ? 0 : this.accumulator - ticks * this.tickMs;
    return ticks;
  }

  /** Fraction (0..1) of the way to the next tick, used to interpolate rendering. */
  get alpha(): number {
    return this.accumulator / this.tickMs;
  }
}
