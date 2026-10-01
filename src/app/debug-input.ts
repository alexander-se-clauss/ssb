import type { PlayerInput } from '../core';
import type { InputSource } from '../ports';

/**
 * Wraps a player's real input so tests and AI agents can take over that player through the
 * debug handle, e.g. to walk a fighter off the stage and end a match.
 */
export class OverridableInput implements InputSource {
  private forced: PlayerInput | null = null;

  constructor(private readonly inner: InputSource) {}

  /** Input to report instead of the real one; null hands control back. */
  override(input: PlayerInput | null): void {
    this.forced = input;
  }

  sample(): PlayerInput {
    // Sample the real source anyway, so taps made meanwhile do not pile up.
    const real = this.inner.sample();
    return this.forced ?? real;
  }

  dispose(): void {
    this.inner.dispose();
  }
}
