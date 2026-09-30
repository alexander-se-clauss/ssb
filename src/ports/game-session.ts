import type { GameEvent, MatchState, PlayerInput, PlayerSlot } from '../core';

/** What the client needs to draw one frame. */
export interface SessionView {
  readonly previous: MatchState;
  readonly current: MatchState;
  /** 0..1 progress between `previous` and `current`, for smooth interpolation. */
  readonly alpha: number;
}

export type Unsubscribe = () => void;

/**
 * The boundary between the client and whoever owns the authoritative game state.
 *
 * Today `LocalGameSession` runs the simulation in the browser. Later a `RemoteGameSession`
 * can implement the same interface by sending inputs over a WebSocket and receiving
 * snapshots from a server, and nothing in the client has to change.
 */
export interface GameSession {
  /** Slots controlled from this client. */
  readonly localSlots: readonly PlayerSlot[];
  /** Report the latest input for a locally controlled slot. */
  setInput(slot: PlayerSlot, input: PlayerInput): void;
  /** Drive the session with wall-clock time (ms). It decides how many ticks to run. */
  update(nowMs: number): void;
  view(): SessionView;
  onEvent(listener: (event: GameEvent) => void): Unsubscribe;
  dispose(): void;
}
