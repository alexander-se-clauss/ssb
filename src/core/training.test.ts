import { describe, expect, it } from 'vitest';
import { TRAINING } from './config';
import { findMove } from './move-data';
import { moveTiming } from './moves';
import { timeLeftFrames } from './rules';
import { createMatch, step } from './simulation';
import { BATTLEFIELD } from './stages';
import { CAPSULE } from './registry';
import { configureTraining, resetTraining } from './training';
import { fighter, inputOf, run, withFighter } from './test-helpers';
import type { MatchState, TrainingSettings, TrainingState } from './types';

const ATTACK = inputOf({ attack: true });
const NONE = inputOf({});

const SETTINGS: TrainingSettings = {
  dummy: 1,
  behaviour: 'stand',
  percent: 0,
  freezePercent: false,
};

/** P1 against a dummy in P2, settled on the stage. */
const training = (settings: Partial<TrainingSettings> = {}): MatchState =>
  run(
    createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
      countdownFrames: 0,
      training: { ...SETTINGS, ...settings },
    }),
    120,
  );

const trainingOf = (state: MatchState): TrainingState => {
  if (!state.training) throw new Error('Not a training match');
  return state.training;
};

/** P1 on the main stage facing right, the dummy right in front, both standing. */
const faceOff = (state: MatchState, dummy: Partial<MatchState['fighters'][number]> = {}) =>
  withFighter(withFighter(state, 0, { position: { x: 0, y: 0 }, facing: 1, grounded: true }), 1, {
    position: { x: 0.8, y: 0 },
    facing: -1,
    grounded: true,
    ...dummy,
  });

const JAB = moveTiming(findMove('jab'));

/** Presses attack once and lets the jab play until it hits. */
const jab = (state: MatchState): MatchState =>
  run(step(state, [ATTACK]), JAB.startupFrames, [NONE]);

describe('training mode', () => {
  it('starts with no combo and no measurement', () => {
    expect(trainingOf(training())).toMatchObject({
      comboHits: 0,
      comboDamage: 0,
      comboActive: false,
      advantage: null,
      lastMove: null,
    });
  });

  it('has no clock and never ends: a KO-ed dummy respawns', () => {
    let state = training();
    expect(timeLeftFrames(state)).toBeNull();
    state = withFighter(state, 1, { position: { x: 0, y: BATTLEFIELD.blastZone.bottom - 1 } });
    state = step(state, []);
    expect(state.phase).toBe('playing');
    expect(fighter(state, 1).action).not.toBe('eliminated');
    expect(state.events).toContainEqual(expect.objectContaining({ type: 'ko', slot: 1 }));
  });

  it('leaves versus matches without training data', () => {
    const versus = createMatch({
      stageId: BATTLEFIELD.id,
      players: [{ characterId: CAPSULE.id }, { characterId: CAPSULE.id }],
      rules: { mode: 'stock', stocks: 1, timeLimitSeconds: 60 },
    });
    expect(versus.training).toBeUndefined();
  });

  describe('dummy behaviour', () => {
    it('stands still whatever its slot reports', () => {
      const state = run(training(), 30, [NONE, inputOf({ x: 1, jump: true })]);
      expect(fighter(state, 1)).toMatchObject({ action: 'idle', grounded: true });
    });

    it('crouches by holding down', () => {
      const state = run(training({ behaviour: 'crouch' }), 5);
      expect(fighter(state, 1).previousInput.y).toBe(-1);
    });

    it('jumps again and again', () => {
      let state = training({ behaviour: 'jump' });
      const airborne: boolean[] = [];
      for (let i = 0; i < 180; i += 1) {
        state = step(state, []);
        airborne.push(!fighter(state, 1).grounded);
      }
      const takeOffs = airborne.filter((up, i) => up && !airborne[i - 1]).length;
      expect(takeOffs).toBeGreaterThanOrEqual(2);
    });

    it('dodges again and again', () => {
      let state = training({ behaviour: 'dodge' });
      let dodges = 0;
      for (let i = 0; i < 180; i += 1) {
        const before = fighter(state, 1).action;
        state = step(state, []);
        if (fighter(state, 1).action === 'sidestepIn' && before !== 'sidestepIn') dodges += 1;
      }
      expect(dodges).toBeGreaterThanOrEqual(2);
    });
  });

  describe('combo counter', () => {
    it('counts the first hit as a one-hit combo with its damage', () => {
      const state = jab(faceOff(training()));
      expect(trainingOf(state)).toMatchObject({
        comboHits: 1,
        comboDamage: fighter(state, 1).damage,
        comboActive: true,
      });
    });

    it('adds a hit that lands while the dummy is still in hitstun', () => {
      const first = jab(faceOff(training()));
      const damage = fighter(first, 1).damage;
      // Still stunned from the first hit, and back in reach of the next jab.
      let state = run(first, 40, [NONE]);
      state = faceOff(state, { action: 'hitstun', hitstunFrames: 60, damage });
      state = { ...state, training: { ...trainingOf(first), watch: null } };
      state = jab(state);
      expect(trainingOf(state)).toMatchObject({ comboHits: 2, comboActive: true });
      expect(trainingOf(state).comboDamage).toBeCloseTo(fighter(state, 1).damage);
    });

    it('ends the combo when the dummy can act again, and keeps its count for the HUD', () => {
      let state = jab(faceOff(training()));
      state = run(state, 120, [NONE]);
      expect(fighter(state, 1).action).not.toBe('hitstun');
      expect(trainingOf(state)).toMatchObject({ comboHits: 1, comboActive: false });
    });

    it('starts over when a hit lands on a dummy that was free', () => {
      let state = jab(faceOff(training()));
      state = run(state, 120, [NONE]);
      state = jab(faceOff(state));
      expect(trainingOf(state)).toMatchObject({ comboHits: 1, comboActive: true });
    });
  });

  describe('frame advantage', () => {
    /** Steps on with nothing pressed and returns the frames until each side can act. */
    const measure = (hit: MatchState): number => {
      let state = hit;
      let attackerFree: number | null = null;
      let targetFree: number | null = null;
      for (
        let frames = 1;
        frames < 300 && (attackerFree === null || targetFree === null);
        frames += 1
      ) {
        state = step(state, [NONE]);
        const attacker = fighter(state, 0);
        const target = fighter(state, 1);
        if (attackerFree === null && attacker.action === 'idle' && attacker.hitlagFrames === 0) {
          attackerFree = frames;
        }
        if (targetFree === null && target.action !== 'hitstun' && target.hitlagFrames === 0) {
          targetFree = frames;
        }
      }
      return (targetFree ?? 0) - (attackerFree ?? 0);
    };

    it('is the frames the attacker acts before the dummy after the hit', () => {
      const hit = jab(faceOff(training()));
      const settledState = run(hit, 120, [NONE]);
      expect(trainingOf(settledState).advantage).toBe(measure(hit));
    });

    it('grows with the dummy percent, since hitstun does', () => {
      const low = run(jab(faceOff(training())), 120, [NONE]);
      const high = run(jab(faceOff(training({ percent: 150, freezePercent: true }))), 120, [NONE]);
      expect(trainingOf(high).advantage ?? 0).toBeGreaterThan(trainingOf(low).advantage ?? 0);
    });
  });

  it("measures a projectile's hit from what its owner does now, not from an unrelated move", () => {
    let state = faceOff(training());
    state = withFighter(state, 0, { position: { x: -4, y: 0 } });
    // P1 starts a jab far away while its own shot is about to reach the dummy.
    state = step(state, [ATTACK]);
    state = {
      ...state,
      objects: [
        {
          id: 0,
          owner: 0,
          moveId: 'pulseShot',
          position: { x: 0.8, y: 0.8 },
          velocity: { x: 0, y: 0 },
          launchVelocity: { x: 0.3, y: 0 },
          facing: 1,
          age: 0,
          lifetime: 60,
          radius: 0.4,
          hit: { damage: 5, angle: 30, baseKnockback: 0.3, knockbackGrowth: 0.01 },
          behavior: { kind: 'straight' },
        },
      ],
    };
    state = step(state, [NONE]);
    expect(trainingOf(state).comboHits).toBe(1);
    expect(fighter(state, 0).moveId).toBe('jab');
    expect(trainingOf(state).watch?.moveId).toBeNull();
  });

  it('remembers the last move of the first player for its frame data', () => {
    const state = run(jab(faceOff(training())), 60, [NONE]);
    expect(trainingOf(state).lastMove).toBe('jab');
  });

  describe('percent', () => {
    it('holds a frozen dummy at its percent, and the combo still counts the damage', () => {
      const state = jab(faceOff(training({ percent: 80, freezePercent: true })));
      expect(fighter(state, 1).damage).toBe(80);
      expect(trainingOf(state).comboDamage).toBeGreaterThan(0);
    });

    it('sets the dummy to a new percent when the settings change', () => {
      const state = configureTraining(training(), { ...SETTINGS, percent: 60 });
      expect(fighter(state, 1).damage).toBe(60);
      expect(trainingOf(state).settings.percent).toBe(60);
    });

    it('keeps the percent within the training limits', () => {
      const state = configureTraining(training(), { ...SETTINGS, percent: 5000 });
      expect(fighter(state, 1).damage).toBe(TRAINING.maxPercent);
    });
  });

  it('resets both fighters to their spawn points, the dummy at its percent, the combo cleared', () => {
    const start = training({ percent: 40 });
    let state = jab(faceOff(start));
    state = resetTraining(state);
    expect(fighter(state, 0).position).toEqual(BATTLEFIELD.spawnPoints[0]);
    expect(fighter(state, 1)).toMatchObject({ damage: 40, action: 'airborne' });
    expect(trainingOf(state)).toMatchObject({ comboHits: 0, advantage: null, watch: null });
  });
});
