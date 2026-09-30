/**
 * Shape of the debug handle from src/app/debug.ts, as seen from the tests.
 * Kept minimal so e2e tests do not compile the app's source.
 */
interface E2eFighter {
  position: { x: number; y: number };
  grounded: boolean;
}

interface Window {
  __SSB__?: {
    state(): { frame: number; fighters: E2eFighter[] };
    restart(): void;
  };
}
