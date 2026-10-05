/**
 * Training mode (#144) as pure functions on `MatchState.training`: what the dummy presses, and
 * what the HUD measures (the combo counter and frame advantage). Settings change only between
 * frames, through `configureTraining` and `resetTraining`, so `step` stays a pure function.
 */
import { TRAINING } from './config';
import { createFighter } from './fighter';
import { NEUTRAL_INPUT, inputOf } from './input';
import type {
  AdvantageWatch,
  FighterState,
  MatchState,
  PlayerInput,
  TrainingSettings,
  TrainingState,
} from './types';

export const createTraining = (settings: TrainingSettings): TrainingState => ({
  settings: { ...settings, percent: clampPercent(settings.percent) },
  comboHits: 0,
  comboDamage: 0,
  comboActive: false,
  advantage: null,
  watch: null,
  lastMove: null,
});

const clampPercent = (percent: number): number =>
  Math.min(Math.max(Math.round(percent), 0), TRAINING.maxPercent);

/**
 * The stick the dummy holds for its DI (#154) while frozen by a hit: towards the stage's centre
 * and up, or away from whoever hit it and down. `undefined` when it holds none.
 */
const diStick = (
  state: MatchState,
  dummy: FighterState,
  settings: TrainingSettings,
): PlayerInput | undefined => {
  if (settings.di === 'none' || dummy.hitlagFrames === 0 || dummy.action !== 'hitstun') {
    return undefined;
  }
  const side = (from: number): number => (dummy.position.x >= from ? 1 : -1);
  if (settings.di === 'survival') {
    const { left, right } = state.stage.blastZone;
    return inputOf({ x: -side((left + right) / 2), y: 1 });
  }
  // A dummy in hitstun was always hit by someone; the stage's centre is only a fallback.
  const attacker = dummy.lastHitBy === null ? undefined : state.fighters[dummy.lastHitBy];
  return inputOf({ x: side(attacker?.position.x ?? 0), y: -1 });
};

/**
 * The dummy's input this frame: its DI while a hit freezes it, else nothing, down held, or jump
 * or dodge pressed whenever it was released last frame, so it repeats them as soon as it can.
 */
export const dummyInput = (
  state: MatchState,
  dummy: FighterState,
  settings: TrainingSettings,
): PlayerInput => {
  const di = diStick(state, dummy, settings);
  if (di) return di;
  switch (settings.behaviour) {
    case 'stand':
      return NEUTRAL_INPUT;
    case 'crouch':
      return inputOf({ y: -1 });
    case 'jump':
      return inputOf({ jump: dummy.grounded && !dummy.previousInput.jump });
    case 'dodge':
      return inputOf({ shield: !dummy.previousInput.shield });
  }
};

/** Replaces the dummy's input; other slots keep theirs. */
export const withDummyInput = (
  state: MatchState,
  inputs: readonly PlayerInput[],
): readonly PlayerInput[] => {
  const settings = state.training?.settings;
  const dummy = settings && state.fighters[settings.dummy];
  if (!settings || !dummy) return inputs;
  return state.fighters.map((f) =>
    f.slot === settings.dummy
      ? dummyInput(state, dummy, settings)
      : (inputs[f.slot] ?? NEUTRAL_INPUT),
  );
};

const setDamage = (state: MatchState, slot: number, damage: number): MatchState => ({
  ...state,
  fighters: state.fighters.map((f) => (f.slot === slot ? { ...f, damage } : f)),
});

/** Applies new settings; the dummy takes the new percent at once. */
export const configureTraining = (state: MatchState, settings: TrainingSettings): MatchState => {
  if (!state.training) return state;
  const clamped = { ...settings, percent: clampPercent(settings.percent) };
  return setDamage(
    { ...state, training: { ...state.training, settings: clamped } },
    clamped.dummy,
    clamped.percent,
  );
};

/** Puts every fighter back on its spawn point, the dummy at its percent, and clears the HUD. */
export const resetTraining = (state: MatchState): MatchState => {
  if (!state.training) return state;
  const { settings } = state.training;
  return setDamage(
    {
      ...state,
      fighters: state.fighters.map((f) => ({
        ...createFighter(f.slot, f.characterId, state.stage, f.stocks),
        previousInput: f.previousInput,
        stick: f.stick,
      })),
      objects: [],
      training: createTraining(settings),
    },
    settings.dummy,
    settings.percent,
  );
};

/** Hitstun or the freeze of a hit: the next hit on such a dummy continues the combo. */
const stunned = (f: FighterState): boolean => f.action === 'hitstun' || f.hitlagFrames > 0;

/** The attacker is busy while frozen, while the move that hit plays on, or in its landing lag. */
const attackerBusy = (f: FighterState, watch: AdvantageWatch): boolean =>
  f.hitlagFrames > 0 ||
  f.action === 'landing' ||
  (f.action === 'attack' && f.moveId === watch.moveId && f.actionFrame >= watch.moveFrame);

/** Follows a running measurement one frame on; returns the advantage once both sides are free. */
const followWatch = (
  watch: AdvantageWatch,
  next: MatchState,
  dummySlot: number,
): { watch: AdvantageWatch | null; advantage: number | null } => {
  const attacker = next.fighters[watch.attacker];
  const dummy = next.fighters[dummySlot];
  const frames = watch.frames + 1;
  if (!attacker || !dummy || frames > TRAINING.maxWatchFrames)
    return { watch: null, advantage: null };
  const attackerFree = watch.attackerFree ?? (attackerBusy(attacker, watch) ? null : frames);
  const targetFree = watch.targetFree ?? (stunned(dummy) ? null : frames);
  if (attackerFree !== null && targetFree !== null) {
    return { watch: null, advantage: targetFree - attackerFree };
  }
  return {
    watch: { ...watch, frames, attackerFree, targetFree, moveFrame: attacker.actionFrame },
    advantage: null,
  };
};

/**
 * Updates the training measurements from one step, `prev` to `next`: hits on the dummy grow the
 * combo while it stays stunned, and the last hit is followed until both sides can act. A frozen
 * dummy is held at its percent afterwards; the combo still counts each hit's damage.
 */
export const trackTraining = (prev: MatchState, next: MatchState): MatchState => {
  const training = prev.training;
  if (!training) return next;
  const { settings } = training;
  const dummy = next.fighters[settings.dummy];
  if (!dummy) return next;
  const hits = next.events.flatMap((event) =>
    event.type === 'hit' && event.target === settings.dummy && event.guard !== 'blocked'
      ? [event]
      : [],
  );
  const lastHit = hits[hits.length - 1];
  const player = next.fighters.find((f) => f.slot !== settings.dummy);
  const lastMove = player?.action === 'attack' ? player.moveId : training.lastMove;

  let updated: TrainingState;
  if (lastHit) {
    const attacker = next.fighters[lastHit.attacker];
    // A hitbox freezes its attacker too; an object's hit does not, so a fighter whose projectile
    // lands is measured from what it is doing now, not from an unrelated move.
    const byHitbox = attacker !== undefined && attacker.hitlagFrames > 0;
    const base = training.comboActive ? training : { comboHits: 0, comboDamage: 0 };
    updated = {
      ...training,
      comboHits: base.comboHits + hits.length,
      comboDamage: base.comboDamage + hits.reduce((sum, hit) => sum + hit.damage, 0),
      comboActive: true,
      watch: {
        attacker: lastHit.attacker,
        moveId: byHitbox && attacker.action === 'attack' ? attacker.moveId : null,
        moveFrame: attacker?.actionFrame ?? 0,
        frames: 0,
        attackerFree: null,
        targetFree: null,
      },
    };
  } else {
    const followed = training.watch
      ? followWatch(training.watch, next, settings.dummy)
      : { watch: null, advantage: null };
    updated = {
      ...training,
      comboActive: training.comboActive && stunned(dummy),
      watch: followed.watch,
      advantage: followed.advantage ?? training.advantage,
    };
  }
  const tracked = { ...next, training: { ...updated, lastMove } };
  return settings.freezePercent ? setDamage(tracked, settings.dummy, settings.percent) : tracked;
};
