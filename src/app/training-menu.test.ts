import { describe, expect, it } from 'vitest';
import { TRAINING, type TrainingSettings } from '../core';
import { adjustTraining, cycle, trainingRows } from './training-menu';

const SETTINGS: TrainingSettings = {
  dummy: 1,
  behaviour: 'stand',
  di: 'none',
  percent: 0,
  freezePercent: false,
};

describe('training panel', () => {
  it('steps the percent and keeps it within the limits', () => {
    expect(adjustTraining(SETTINGS, 'percent', 1).percent).toBe(TRAINING.percentStep);
    expect(adjustTraining(SETTINGS, 'percent', -1).percent).toBe(0);
    const top = { ...SETTINGS, percent: TRAINING.maxPercent };
    expect(adjustTraining(top, 'percent', 1).percent).toBe(TRAINING.maxPercent);
  });

  it('toggles freeze and cycles the behaviour both ways', () => {
    expect(adjustTraining(SETTINGS, 'freeze', 1).freezePercent).toBe(true);
    expect(adjustTraining(SETTINGS, 'behaviour', 1).behaviour).toBe('crouch');
    expect(adjustTraining(SETTINGS, 'behaviour', -1).behaviour).toBe('dodge');
  });

  it('cycles the dummy DI both ways (#154)', () => {
    expect(adjustTraining(SETTINGS, 'di', 1).di).toBe('survival');
    expect(adjustTraining(SETTINGS, 'di', -1).di).toBe('combo');
  });

  it('cycles any list with wrap-around', () => {
    expect(cycle(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(cycle(['a', 'b', 'c'], 'a', -1)).toBe('c');
  });

  it('labels the rows with the current values', () => {
    expect(trainingRows({ ...SETTINGS, percent: 40 }, 'Vela').map((row) => row.label)).toEqual([
      'Dummy percent: 40%',
      'Freeze percent: Off',
      'Dummy: Stand',
      'Dummy DI: None',
      'Dummy fighter: Vela',
    ]);
  });
});
