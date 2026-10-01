import { describe, expect, it } from 'vitest';
import type { CharacterDef } from '../core';
import {
  createSelect,
  reduceSelect,
  type SelectAction,
  type SelectState,
} from './character-select';
import { screenMusic, selectCue } from './menu-sounds';

const ROSTER: CharacterDef[] = [
  { id: 'a', name: 'A', moves: {} },
  { id: 'b', name: 'B', moves: {} },
];

const apply = (state: SelectState, ...actions: SelectAction[]): SelectState =>
  actions.reduce((s, action) => reduceSelect(s, action, ROSTER, 4), state);

/** The cue for doing `actions` in one frame, starting from `state`. */
const cueFor = (state: SelectState, ...actions: SelectAction[]) =>
  selectCue(state, apply(state, ...actions));

const onePlayer = apply(createSelect(4), { type: 'join', device: 0 });

describe('selectCue', () => {
  it('plays join when a device joins and leave when a player leaves', () => {
    expect(cueFor(createSelect(4), { type: 'join', device: 3 })).toBe('join');
    expect(cueFor(onePlayer, { type: 'cancel', player: 0 })).toBe('leave');
  });

  it('plays pick on a pick and back on an un-pick', () => {
    expect(cueFor(onePlayer, { type: 'confirm', player: 0 })).toBe('pick');
    const picked = apply(onePlayer, { type: 'confirm', player: 0 });
    expect(cueFor(picked, { type: 'cancel', player: 0 })).toBe('menu-back');
  });

  it('hears a pick even when another player un-picks on the same frame', () => {
    const twoPlayers = apply(
      onePlayer,
      { type: 'join', device: 1 },
      { type: 'confirm', player: 1 },
    );
    expect(cueFor(twoPlayers, { type: 'confirm', player: 0 }, { type: 'cancel', player: 1 })).toBe(
      'pick',
    );
  });

  it('plays move when a cursor moves', () => {
    expect(cueFor(onePlayer, { type: 'move', player: 0, dx: 1, dy: 0 })).toBe('menu-move');
  });

  it('plays menu cues while browsing before joining', () => {
    const empty = createSelect(4);
    const banner = apply(empty, { type: 'guest-move', device: 3, dx: 0, dy: -1 });
    expect(selectCue(empty, banner)).toBe('menu-move');
    expect(cueFor(banner, { type: 'guest-confirm', device: 3 })).toBe('menu-confirm');
    expect(selectCue(banner, banner)).toBeNull();
  });

  it('plays confirm when the rules open and back when they close', () => {
    const onBanner = apply(onePlayer, { type: 'move', player: 0, dx: 0, dy: -1 });
    expect(cueFor(onBanner, { type: 'confirm', player: 0 })).toBe('menu-confirm');
    const open = apply(onBanner, { type: 'confirm', player: 0 });
    expect(cueFor(open, { type: 'cancel', player: 0 })).toBe('menu-back');
  });

  it('plays one cue per frame, the most important one', () => {
    expect(
      cueFor(onePlayer, { type: 'move', player: 0, dx: 1, dy: 0 }, { type: 'join', device: 1 }),
    ).toBe('join');
  });

  it('hears a join even when another player leaves on the same frame', () => {
    const twoPlayers = apply(onePlayer, { type: 'join', device: 1 });
    expect(cueFor(twoPlayers, { type: 'cancel', player: 0 }, { type: 'join', device: 2 })).toBe(
      'join',
    );
  });

  it('does not take the slot shift after a leave for a cursor move', () => {
    const twoPlayers = apply(
      onePlayer,
      { type: 'join', device: 1 },
      { type: 'move', player: 1, dx: 0, dy: -1 },
    );
    const after = apply(twoPlayers, { type: 'cancel', player: 0 });
    expect(selectCue(twoPlayers, after)).toBe('leave');
    expect(selectCue({ ...twoPlayers, devices: [null, 1, null, null] }, after)).toBeNull();
  });

  it('stays quiet when nothing changed, like a held button', () => {
    expect(selectCue(onePlayer, onePlayer)).toBeNull();
    expect(cueFor(onePlayer, { type: 'start', player: 0 })).toBeNull();
  });
});

describe('screenMusic', () => {
  it('plays the stage in a match, a jingle on results and the menu theme elsewhere', () => {
    expect(screenMusic('match', 'final-destination')).toBe('final-destination');
    expect(screenMusic('results', 'battlefield')).toBe('results');
    expect(screenMusic('title', 'battlefield')).toBe('menu');
    expect(screenMusic('stage-select', 'battlefield')).toBe('menu');
  });
});
