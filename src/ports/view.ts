import type { SessionView } from './game-session';

/** Anything that presents the game to the player: the 3D scene, a HUD, audio, a debug overlay. */
export interface GameView {
  render(view: SessionView): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
