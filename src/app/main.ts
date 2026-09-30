/**
 * Composition root: the only place that knows which concrete adapters are used.
 * Swapping keyboard for gamepad, or the local session for a network one, happens here.
 */
import { BATTLEFIELD, createMatch, type MatchConfig } from '../core';
import { DomHud } from '../adapters/dom-hud/dom-hud';
import {
  KeyboardInputSource,
  PLAYER_ONE_KEYS,
  PLAYER_TWO_KEYS,
} from '../adapters/keyboard-input/keyboard-input-source';
import { LocalGameSession } from '../adapters/local-session/local-game-session';
import { ThreeView } from '../adapters/three-renderer/three-view';
import type { GameSession, GameView, InputSource } from '../ports';
import { installDebugHandle } from './debug';
import './style.css';

const MATCH: MatchConfig = { stage: BATTLEFIELD, playerCount: 2, stocks: 3 };

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Missing #app container');

const inputs: InputSource[] = [
  new KeyboardInputSource(PLAYER_ONE_KEYS),
  new KeyboardInputSource(PLAYER_TWO_KEYS),
];
const views: GameView[] = [new ThreeView(container, MATCH.stage), new DomHud(container)];
let session: GameSession = new LocalGameSession(createMatch(MATCH));

const restart = (): void => {
  session.dispose();
  session = new LocalGameSession(createMatch(MATCH));
};

installDebugHandle({ session: () => session, restart });

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR' && session.view().current.phase === 'finished') restart();
});

const resize = (): void => {
  for (const view of views) view.resize(container.clientWidth, container.clientHeight);
};
window.addEventListener('resize', resize);
resize();

const frame = (now: number): void => {
  session.localSlots.forEach((slot, index) => {
    const source = inputs[index];
    if (source) session.setInput(slot, source.sample());
  });
  session.update(now);
  const view = session.view();
  for (const v of views) v.render(view);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
