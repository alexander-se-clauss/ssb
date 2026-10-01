/**
 * Composition root: the only place that knows which concrete adapters are used.
 * Swapping keyboard for gamepad, or the local session for a network one, happens here.
 */
import { createMatch } from '../core';
import { DomHud } from '../adapters/dom-hud/dom-hud';
import {
  KeyboardInputSource,
  PLAYER_ONE_KEYS,
  PLAYER_TWO_KEYS,
  describeKeys,
} from '../adapters/keyboard-input/keyboard-input-source';
import { OverridableInput } from '../adapters/debug-input/overridable-input';
import { GAMEPAD_LABELS, GamepadInputSource } from '../adapters/gamepad-input/gamepad-input-source';
import { LocalGameSession } from '../adapters/local-session/local-game-session';
import { ThreeView } from '../adapters/three-renderer/three-view';
import { App } from './app';
import { installDebugHandle } from './debug';
import './style.css';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Missing #app container');

// Every controller that can join on character select: the two keyboard halves and four gamepads.
// Each is wrapped so the debug handle can take a player over in tests.
const keyboards = [PLAYER_ONE_KEYS, PLAYER_TWO_KEYS].map(
  (keys) => new OverridableInput(new KeyboardInputSource(keys)),
);
const gamepads = [0, 1, 2, 3].map((index) => new OverridableInput(new GamepadInputSource(index)));

// Debug overlay of hurtboxes and attack hitboxes. F2 toggles it at runtime; it stays on across
// matches until toggled off again.
let showBoxes = false;
let view: ThreeView | undefined;
const setShowBoxes = (on: boolean): void => {
  showBoxes = on;
  view?.setShowBoxes(on);
};
window.addEventListener('keydown', (event) => {
  if (event.code !== 'F2' || event.repeat) return;
  event.preventDefault();
  setShowBoxes(!showBoxes);
});

const app = new App(container, {
  devices: [
    ...keyboards.map((source) => ({ source, drivesMenus: false })),
    ...gamepads.map((source) => ({ source, drivesMenus: true })),
  ],
  createSession: (config) => new LocalGameSession(createMatch(config)),
  createViews: (root, stage) => {
    view = new ThreeView(root, stage);
    view.setShowBoxes(showBoxes);
    return [view, new DomHud(root)];
  },
  controls: [
    { device: 'Left keys', labels: describeKeys(PLAYER_ONE_KEYS) },
    { device: 'Right keys', labels: describeKeys(PLAYER_TWO_KEYS) },
    { device: 'Gamepad', labels: GAMEPAD_LABELS },
  ],
});

installDebugHandle(app, [...keyboards, ...gamepads], setShowBoxes);

window.addEventListener('resize', () => app.resize());

const frame = (now: number): void => {
  app.frame(now);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
