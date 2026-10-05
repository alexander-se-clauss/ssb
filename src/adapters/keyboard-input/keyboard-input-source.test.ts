import { describe, expect, it } from 'vitest';
import {
  KeyboardInputSource,
  PLAYER_ONE_KEYS,
  PLAYER_TWO_KEYS,
  describeKeys,
} from './keyboard-input-source';

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

  it('aims up without jumping, so up tilt and up smash work on the keyboard', () => {
    const target = new EventTarget();
    const source = new KeyboardInputSource(PLAYER_TWO_KEYS, target);
    target.dispatchEvent(key('keydown', 'ArrowUp'));
    expect(source.sample()).toMatchObject({ y: 1, jump: false });
    target.dispatchEvent(key('keydown', 'Numpad0'));
    expect(source.sample()).toMatchObject({ y: 1, jump: true });
  });

  it('short hops on V for the left keys and Num 1 for the right keys (#147)', () => {
    const target = new EventTarget();
    const left = new KeyboardInputSource(PLAYER_ONE_KEYS, target);
    const right = new KeyboardInputSource(PLAYER_TWO_KEYS, target);
    target.dispatchEvent(key('keydown', 'KeyV'));
    expect(left.sample()).toMatchObject({ shortHop: true, jump: false });
    expect(right.sample().shortHop).toBe(false);
    target.dispatchEvent(key('keydown', 'Numpad1'));
    expect(right.sample()).toMatchObject({ shortHop: true, jump: false });
  });

  it('has a grab key for each player (#159)', () => {
    const target = new EventTarget();
    const left = new KeyboardInputSource(PLAYER_ONE_KEYS, target);
    const right = new KeyboardInputSource(PLAYER_TWO_KEYS, target);
    target.dispatchEvent(key('keydown', 'KeyC'));
    expect(left.sample()).toMatchObject({ grab: true, shield: false, attack: false });
    expect(right.sample().grab).toBe(false);
    target.dispatchEvent(key('keydown', 'Numpad3'));
    expect(right.sample().grab).toBe(true);
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

describe('describeKeys', () => {
  it('names the keys of a key map the way they read on a keyboard', () => {
    expect(describeKeys(PLAYER_ONE_KEYS)).toEqual({
      move: 'A / D',
      jump: 'Space',
      up: 'W',
      down: 'S',
      attack: 'F',
      special: 'G',
      dodge: 'H',
      shortHop: 'V',
      grab: 'C',
      start: 'Enter',
    });
    expect(describeKeys(PLAYER_TWO_KEYS)).toEqual({
      move: '← / →',
      jump: 'Num 0',
      up: '↑',
      down: '↓',
      attack: '.',
      special: '/',
      dodge: 'Right Shift',
      shortHop: 'Num 1',
      grab: 'Num 3',
      start: 'Enter',
    });
  });
});
