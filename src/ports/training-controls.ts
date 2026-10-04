import type { TrainingSettings } from '../core';
import type { GameSession } from './game-session';

/**
 * What the training panel (#144) may do to a running session beyond feeding it input: pause it,
 * step it one frame at a time, change the dummy's settings, and put everyone back (ADR 0008).
 * Changes apply between frames, so the simulation itself stays a pure `step`.
 */
export interface TrainingControls {
  readonly paused: boolean;
  /** While paused, wall-clock time runs no frames; resuming does not catch up on them. */
  setPaused(paused: boolean): void;
  /** Runs exactly one frame; meant for a paused session. */
  advanceFrame(): void;
  readonly settings: TrainingSettings;
  configure(settings: TrainingSettings): void;
  /** Fighters back to their spawn points, the dummy at its percent, the measurements cleared. */
  reset(): void;
}

/** A session that also takes training controls. */
export type TrainingSession = GameSession & TrainingControls;
