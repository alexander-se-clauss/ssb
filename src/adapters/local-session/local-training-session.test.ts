import { describe, expect, it } from 'vitest';
import { BATTLEFIELD, CAPSULE, TICK_MS, createMatch, type TrainingSettings } from '../../core';
import { LocalTrainingSession } from './local-training-session';

const SETTINGS: TrainingSettings = {
  dummy: 1,
  behaviour: 'stand',
  percent: 30,
  freezePercent: false,
};

const session = (): LocalTrainingSession =>
  new LocalTrainingSession(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
      countdownFrames: 0,
      training: SETTINGS,
    }),
  );

const frameOf = (s: LocalTrainingSession): number => s.view().current.frame;

describe('LocalTrainingSession', () => {
  it('runs no frames while paused, and does not catch up on resume', () => {
    const s = session();
    s.update(0);
    s.setPaused(true);
    s.update(TICK_MS * 30);
    expect(frameOf(s)).toBe(0);
    s.setPaused(false);
    s.update(TICK_MS * 31 + 1);
    expect(frameOf(s)).toBe(1);
  });

  it('advances exactly one frame at a time while paused', () => {
    const s = session();
    s.setPaused(true);
    s.advanceFrame();
    s.advanceFrame();
    expect(frameOf(s)).toBe(2);
  });

  it('applies new settings and resets', () => {
    const s = session();
    s.configure({ ...SETTINGS, percent: 90 });
    expect(s.settings.percent).toBe(90);
    expect(s.view().current.fighters[1]?.damage).toBe(90);
    s.advanceFrame();
    s.reset();
    expect(s.view().current.fighters[0]?.position).toEqual(BATTLEFIELD.spawnPoints[0]);
  });

  it('holds the picture still while paused', () => {
    const s = session();
    s.advanceFrame();
    s.setPaused(true);
    s.update(0);
    s.update(TICK_MS / 2);
    const view = s.view();
    expect(view.previous).toBe(view.current);
    expect(view.alpha).toBe(1);
  });

  it('does not blend from the old positions after a reset', () => {
    const s = session();
    for (let i = 0; i < 30; i += 1) s.advanceFrame();
    s.reset();
    expect(s.view().previous).toBe(s.view().current);
  });

  it('refuses a match that is not a training match', () => {
    const versus = createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
    });
    expect(() => new LocalTrainingSession(versus)).toThrow();
  });
});
