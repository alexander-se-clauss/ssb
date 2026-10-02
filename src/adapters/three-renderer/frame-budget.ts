/** Measure the first drawings after the one that compiles the shaders, then one in this many. */
const MEASURE_EVERY = 60;

/**
 * Decides when a decorative scene draws, so it never starves the page: it animates only as often
 * as the measured cost of a drawing stays within its `share` of the time. On a real GPU drawing
 * is cheap and it draws every frame; on a software renderer, such as the one CI runs the browser
 * tests on, it falls back to a new picture every few seconds.
 */
export class FrameBudget {
  private cost = 0;
  private drawings = 0;
  private lastDrawing = -Infinity;

  constructor(private readonly share = 0.1) {}

  /** `changed`: the picture must be redrawn (resize). `animated`: the picture moves. */
  shouldDraw(
    now: number,
    scene: { readonly animated: boolean; readonly changed: boolean },
  ): boolean {
    if (scene.changed) return true;
    return scene.animated && now - this.lastDrawing >= this.cost * (1 / this.share - 1);
  }

  /** Whether the coming drawing should be timed (timing waits for the GPU, so not every one). */
  get measuring(): boolean {
    return this.drawings > 0 && (this.drawings <= 3 || this.drawings % MEASURE_EVERY === 0);
  }

  /** Records a drawing at frame time `now`, with its cost in ms when it was measured. */
  drew(now: number, cost?: number): void {
    this.drawings++;
    this.lastDrawing = now;
    if (cost !== undefined) this.cost = cost;
  }
}
