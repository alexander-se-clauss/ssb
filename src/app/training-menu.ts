import { TRAINING, type DummyBehaviour, type DummyDi, type TrainingSettings } from '../core';

/** A setting row in the training panel (#144). */
export type TrainingField = 'percent' | 'freeze' | 'behaviour' | 'di' | 'fighter';

export interface TrainingRow {
  readonly field: TrainingField;
  readonly label: string;
}

export const BEHAVIOURS: readonly DummyBehaviour[] = ['stand', 'crouch', 'jump', 'dodge'];

const BEHAVIOUR_LABEL: Readonly<Record<DummyBehaviour, string>> = {
  stand: 'Stand',
  crouch: 'Crouch',
  jump: 'Jump',
  dodge: 'Dodge',
};

/** The dummy's DI (#154): none, survival DI (in and up) or combo DI (away and down). */
export const DIS: readonly DummyDi[] = ['none', 'survival', 'combo'];

const DI_LABEL: Readonly<Record<DummyDi, string>> = {
  none: 'None',
  survival: 'Survival',
  combo: 'Combo',
};

const wrap = (index: number, size: number): number => ((index % size) + size) % size;

/** The next entry of `list` after `current` in the direction of `delta`, wrapping around. */
export const cycle = <T>(list: readonly T[], current: T, delta: 1 | -1): T =>
  list[wrap(list.indexOf(current) + delta, list.length)] ?? current;

/**
 * The settings after left (-1) or right (+1) on a row. The dummy's fighter is not a setting of
 * the running match; the app restarts training with it.
 */
export const adjustTraining = (
  settings: TrainingSettings,
  field: Exclude<TrainingField, 'fighter'>,
  delta: 1 | -1,
): TrainingSettings => {
  switch (field) {
    case 'percent':
      return {
        ...settings,
        percent: Math.min(
          TRAINING.maxPercent,
          Math.max(0, settings.percent + delta * TRAINING.percentStep),
        ),
      };
    case 'freeze':
      return { ...settings, freezePercent: !settings.freezePercent };
    case 'behaviour':
      return { ...settings, behaviour: cycle(BEHAVIOURS, settings.behaviour, delta) };
    case 'di':
      return { ...settings, di: cycle(DIS, settings.di, delta) };
  }
};

/** The setting rows, top to bottom, labelled with their current values. */
export const trainingRows = (settings: TrainingSettings, dummyName: string): TrainingRow[] => [
  { field: 'percent', label: `Dummy percent: ${settings.percent}%` },
  { field: 'freeze', label: `Freeze percent: ${settings.freezePercent ? 'On' : 'Off'}` },
  { field: 'behaviour', label: `Dummy: ${BEHAVIOUR_LABEL[settings.behaviour]}` },
  { field: 'di', label: `Dummy DI: ${DI_LABEL[settings.di]}` },
  { field: 'fighter', label: `Dummy fighter: ${dummyName}` },
];
