import {
  FixedStepClock,
  NEUTRAL_INPUT,
  TICK_MS,
  step,
  type GameEvent,
  type MatchState,
  type PlayerInput,
  type PlayerSlot,
} from '../../core';
import type { GameSession, SessionView, Unsubscribe } from '../../ports';

/** Runs the authoritative simulation in the browser. Used for local (couch) multiplayer. */
export class LocalGameSession implements GameSession {
  readonly localSlots: readonly PlayerSlot[];
  protected readonly clock = new FixedStepClock(TICK_MS);
  private readonly inputs: PlayerInput[];
  private readonly listeners = new Set<(event: GameEvent) => void>();
  private previous: MatchState;
  protected current: MatchState;

  constructor(initial: MatchState) {
    this.previous = initial;
    this.current = initial;
    this.localSlots = initial.fighters.map((f) => f.slot);
    this.inputs = initial.fighters.map(() => NEUTRAL_INPUT);
  }

  setInput(slot: PlayerSlot, input: PlayerInput): void {
    this.inputs[slot] = input;
  }

  update(nowMs: number): void {
    const ticks = this.clock.advance(nowMs);
    for (let i = 0; i < ticks; i += 1) this.tick();
  }

  /** Advances exactly one simulation tick. Public so tests and tools can drive the session. */
  tick(): void {
    this.previous = this.current;
    this.current = step(this.current, this.inputs);
    for (const event of this.current.events) {
      for (const listener of this.listeners) listener(event);
    }
  }

  /** Replaces the state outside a tick, e.g. a reset; nothing is interpolated across it. */
  protected replaceState(state: MatchState): void {
    this.previous = state;
    this.current = state;
  }

  view(): SessionView {
    return { previous: this.previous, current: this.current, alpha: this.clock.alpha };
  }

  onEvent(listener: (event: GameEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }
}
