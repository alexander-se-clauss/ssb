import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, inputOf } from '../core';
import { menuCommands, menuDirection } from './menu-commands';

describe('menuDirection', () => {
  it('reads a diagonal along its stronger axis only, with up as -1 like screen rows', () => {
    expect(menuDirection(inputOf({ x: 1, y: 0.6 }))).toEqual({ dx: 1, dy: 0 });
    expect(menuDirection(inputOf({ x: 0.3, y: 0.9 }))).toEqual({ dx: 0, dy: -1 });
    expect(menuDirection(inputOf({ x: 0.3, y: 0.2 }))).toEqual({ dx: 0, dy: 0 });
  });
});

describe('menuCommands', () => {
  it('moves once per push of the stick, not every frame it is held', () => {
    expect(menuCommands(NEUTRAL_INPUT, inputOf({ y: -1 }))).toEqual(['down']);
    expect(menuCommands(inputOf({ y: -1 }), inputOf({ y: -1 }))).toEqual([]);
    expect(menuCommands(NEUTRAL_INPUT, inputOf({ x: -1 }))).toEqual(['left']);
    expect(menuCommands(inputOf({ x: -1 }), inputOf({ y: 1 }))).toEqual(['up']);
  });

  it('confirms with attack and goes back with special, on the press only', () => {
    expect(menuCommands(NEUTRAL_INPUT, inputOf({ attack: true }))).toEqual(['confirm']);
    expect(menuCommands(NEUTRAL_INPUT, inputOf({ special: true }))).toEqual(['back']);
    expect(menuCommands(inputOf({ attack: true }), inputOf({ attack: true }))).toEqual([]);
  });

  it('gives start for the Start button, on the press only', () => {
    expect(menuCommands(NEUTRAL_INPUT, inputOf({ start: true }))).toEqual(['start']);
    expect(menuCommands(inputOf({ start: true }), inputOf({ start: true }))).toEqual([]);
  });

  it('does not treat tap-jump as a confirm', () => {
    expect(menuCommands(NEUTRAL_INPUT, inputOf({ y: 1, jump: true }))).toEqual(['up']);
  });
});
