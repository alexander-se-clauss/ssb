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
import { LocalGameSession } from '../adapters/local-session/local-game-session';
import { ThreeView } from '../adapters/three-renderer/three-view';
import { App } from './app';
import { installDebugHandle } from './debug';
import './style.css';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Missing #app container');

// Each player's keyboard, wrapped so the debug handle can take a player over in tests.
const inputs = [PLAYER_ONE_KEYS, PLAYER_TWO_KEYS].map(
  (keys) => new OverridableInput(new KeyboardInputSource(keys)),
);

const app = new App(container, {
  inputs,
  createSession: (config) => new LocalGameSession(createMatch(config)),
  createViews: (root, stage) => [new ThreeView(root, stage), new DomHud(root)],
  controls: [describeKeys(PLAYER_ONE_KEYS), describeKeys(PLAYER_TWO_KEYS)],
});

installDebugHandle(app, inputs);

window.addEventListener('resize', () => app.resize());

const frame = (now: number): void => {
  app.frame(now);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
