/**
 * Composition root: the only place that knows which concrete adapters are used.
 * Swapping keyboard for gamepad, or the local session for a network one, happens here.
 */
import { BATTLEFIELD, CAPSULE, createMatch, type MatchConfig } from '../core';
import { DomHud } from '../adapters/dom-hud/dom-hud';
import {
  KeyboardInputSource,
  PLAYER_ONE_KEYS,
  PLAYER_TWO_KEYS,
} from '../adapters/keyboard-input/keyboard-input-source';
import { LocalGameSession } from '../adapters/local-session/local-game-session';
import { ThreeView } from '../adapters/three-renderer/three-view';
import { App } from './app';
import { installDebugHandle } from './debug';
import './style.css';

// Fixed until the menus (epic #1) build this config from the player's picks.
const MATCH: MatchConfig = {
  stageId: BATTLEFIELD.id,
  players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
  stocks: 3,
};

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Missing #app container');

const app = new App(
  container,
  {
    inputs: [new KeyboardInputSource(PLAYER_ONE_KEYS), new KeyboardInputSource(PLAYER_TWO_KEYS)],
    createSession: (config) => new LocalGameSession(createMatch(config)),
    createViews: (root, stage) => [new ThreeView(root, stage), new DomHud(root)],
  },
  MATCH,
);

installDebugHandle(app);

window.addEventListener('resize', () => app.resize());

const frame = (now: number): void => {
  app.frame(now);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
