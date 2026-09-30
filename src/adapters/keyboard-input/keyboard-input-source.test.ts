import { describe, expect, it } from 'vitest';
import { KeyboardInputSource, PLAYER_ONE_KEYS } from './keyboard-input-source';

const key = (type: 'keydown' | 'keyup', code: string): Event =>
  Object.assign(new Event(type), { code });

describe('KeyboardInputSource', () => {
  it('maps held keys to stick directions and buttons', () => {
    const target = new EventTarget();
    const source = new KeyboardInputSource(PLAYER_ONE_KEYS, target);
    target.dispatchEvent(key('keydown', 'KeyD'));
    target.dispatchEvent(key('keydown', 'KeyF'));
    expect(source.sample()).toMatchObject({ x: 1, y: 0, attack: true, jump: false });
  });

  it('keeps a tap that is released before the next sample', () => {
    const target = new EventTarget();
    const source = new KeyboardInputSource(PLAYER_ONE_KEYS, target);
    target.dispatchEvent(key('keydown', 'KeyF'));
    target.dispatchEvent(key('keyup', 'KeyF'));
    expect(source.sample().attack).toBe(true);
    expect(source.sample().attack).toBe(false);
  });

  it('stops listening after dispose', () => {
    const target = new EventTarget();
    const source = new KeyboardInputSource(PLAYER_ONE_KEYS, target);
    source.dispose();
    target.dispatchEvent(key('keydown', 'KeyD'));
    expect(source.sample().x).toBe(0);
  });
});
