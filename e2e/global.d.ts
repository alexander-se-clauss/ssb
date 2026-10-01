/**
 * Shape of the debug handle from src/app/debug.ts, as seen from the tests.
 * Kept minimal so e2e tests do not compile the app's source.
 */
interface E2eFighter {
  stocks: number;
  position: { x: number; y: number };
  grounded: boolean;
  pose: { torso: number; upperLegFront: number };
}

interface Window {
  __SSB__?: {
    screen(): string;
    state():
      | {
          frame: number;
          stage: { id: string };
          fighters: E2eFighter[];
          rules: { mode: string; stocks: number; timeLimitSeconds: number };
        }
      | undefined;
    characterSelect():
      { devices: (number | null)[]; cursors: number[]; picks: (string | null)[] } | undefined;
    rules(): { mode: string; stocks: number; timeLimitSeconds: number };
    restart(): void;
    hold(player: number, input: { x?: number; y?: number; jump?: boolean; attack?: boolean }): void;
    release(player: number): void;
  };
}
