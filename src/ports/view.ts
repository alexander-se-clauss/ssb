import type { SessionView } from './game-session';

/** Anything that draws the game for the player: the 3D scene, a HUD, a debug overlay. */
export interface GameView {
  render(view: SessionView): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
