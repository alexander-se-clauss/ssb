import {
  configureTraining,
  resetTraining,
  type MatchState,
  type TrainingSettings,
} from '../../core';
import type { SessionView, TrainingSession } from '../../ports';
import { LocalGameSession } from './local-game-session';

/** A local session with the training panel's controls (#144): pause, frame advance, settings. */
export class LocalTrainingSession extends LocalGameSession implements TrainingSession {
  private pausedNow = false;

  constructor(initial: MatchState) {
    if (!initial.training) throw new Error('A training session needs a training match');
    super(initial);
  }

  get paused(): boolean {
    return this.pausedNow;
  }

  get settings(): TrainingSettings {
    const training = this.current.training;
    if (!training) throw new Error('The training match lost its training state');
    return training.settings;
  }

  setPaused(paused: boolean): void {
    this.pausedNow = paused;
  }

  override update(nowMs: number): void {
    // The clock still sees the time, so resuming starts from now instead of catching up.
    if (this.pausedNow) this.clock.advance(nowMs);
    else super.update(nowMs);
  }

  /** While paused, the picture holds still on the current frame instead of interpolating. */
  override view(): SessionView {
    const view = super.view();
    return this.pausedNow ? { ...view, previous: view.current, alpha: 1 } : view;
  }

  advanceFrame(): void {
    this.tick();
  }

  configure(settings: TrainingSettings): void {
    this.replaceState(configureTraining(this.current, settings));
  }

  reset(): void {
    this.replaceState(resetTraining(this.current));
  }
}
