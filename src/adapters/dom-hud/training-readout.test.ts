import { describe, expect, it } from 'vitest';
import {
  BATTLEFIELD,
  CAPSULE,
  createMatch,
  findMove,
  moveTiming,
  type MatchState,
  type TrainingState,
} from '../../core';
import { moveName, phaseOf, trainingReadout } from './training-readout';

const match = (): MatchState =>
  createMatch({
    stageId: BATTLEFIELD.id,
    players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
    rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
    countdownFrames: 0,
    training: { dummy: 1, behaviour: 'stand', percent: 0, freezePercent: false },
  });

const withTraining = (state: MatchState, patch: Partial<TrainingState>): MatchState => {
  if (!state.training) throw new Error('Not a training match');
  return { ...state, training: { ...state.training, ...patch } };
};

const JAB = moveTiming(findMove('jab'));

describe('trainingReadout', () => {
  it('is null outside training', () => {
    const versus = createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
    });
    expect(trainingReadout(versus)).toBeNull();
  });

  it('signs the frame advantage, with a dash before any hit', () => {
    expect(trainingReadout(match())?.advantage).toBe('–');
    expect(trainingReadout(withTraining(match(), { advantage: 3 }))?.advantage).toBe('+3');
    expect(trainingReadout(withTraining(match(), { advantage: -9 }))?.advantage).toBe('-9');
    expect(trainingReadout(withTraining(match(), { advantage: 0 }))?.advantage).toBe('0');
  });

  it('shows the move being played with its frame, counted from 1', () => {
    const state = match();
    const playing = {
      ...state,
      fighters: state.fighters.map((f) =>
        f.slot === 0 ? { ...f, action: 'attack' as const, moveId: 'jab', actionFrame: 0 } : f,
      ),
    };
    expect(trainingReadout(playing)?.move).toEqual({
      name: 'Jab',
      frame: 1,
      phase: 'startup',
      active: [JAB.startupFrames + 1, JAB.startupFrames + JAB.activeFrames],
      total: JAB.totalFrames,
    });
  });

  it('keeps the last move on show once it is over, without a frame', () => {
    const move = trainingReadout(withTraining(match(), { lastMove: 'jab' }))?.move;
    expect(move).toMatchObject({ name: 'Jab', frame: null, phase: null });
  });
});

describe('phaseOf', () => {
  it('splits a move into startup, active and endlag frames', () => {
    expect(phaseOf('jab', JAB.startupFrames - 1)).toBe('startup');
    expect(phaseOf('jab', JAB.startupFrames)).toBe('active');
    expect(phaseOf('jab', JAB.startupFrames + JAB.activeFrames)).toBe('endlag');
  });
});

describe('moveName', () => {
  it('turns move ids into words', () => {
    expect(moveName('forwardSmash')).toBe('Forward smash');
    expect(moveName('jab2')).toBe('Jab 2');
  });
});
