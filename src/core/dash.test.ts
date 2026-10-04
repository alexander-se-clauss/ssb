import { describe, expect, it } from 'vitest';
import { FIGHTER, RIVET_STATS, STICK, VELA_STATS } from './config';
import { CAPSULE, RIVET, VELA } from './registry';
import { step } from './simulation';
import { fighter, inputOf, newMatch, settled, withFighter } from './test-helpers';
import type { CharacterStats, MatchState, PlayerInput } from './types';

const NONE = inputOf({});
const RIGHT = inputOf({ x: 1 });
const LEFT = inputOf({ x: -1 });

/** P1 standing still on the main stage at `x`, facing right; P2 on its platform out of the way. */
const standing = (x = -4, characterId = CAPSULE.id): MatchState =>
  withFighter(settled(newMatch()), 0, {
    characterId,
    position: { x, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    grounded: true,
    action: 'idle',
    actionFrame: 0,
  });

/** Steps P1 through the inputs one frame each and returns every frame's state. */
const play = (state: MatchState, inputs: readonly PlayerInput[]): MatchState[] => {
  const frames: MatchState[] = [];
  let now = state;
  for (const input of inputs) {
    now = step(now, [input]);
    frames.push(now);
  }
  return frames;
};

const last = (frames: readonly MatchState[]): MatchState => {
  const end = frames[frames.length - 1];
  if (!end) throw new Error('No frames played');
  return end;
};

const hold = (input: PlayerInput, frames: number): PlayerInput[] =>
  Array<PlayerInput>(frames).fill(input);

/** A stick pushed slowly to `x`: never fast enough for a flick. */
const slowPush = (x: number): PlayerInput[] =>
  [0.25, 0.4, 0.55, 0.7, 0.85, 1].map((share) => inputOf({ x: x * share }));

/** Into a full run to the right: the dash, then a few frames of running. */
const running = (characterId = CAPSULE.id, stats: CharacterStats = FIGHTER): MatchState =>
  last(play(standing(-6, characterId), hold(RIGHT, stats.initialDashFrames + 20)));

describe('Melee-style ground movement (#146)', () => {
  describe('initial dash', () => {
    it('starts on a sideways flick of the stick with a burst of speed, facing the flick', () => {
      const state = step(standing(), [LEFT]);
      expect(fighter(state, 0)).toMatchObject({ action: 'dash', facing: -1, grounded: true });
      expect(fighter(state, 0).velocity.x).toBeCloseTo(-FIGHTER.dashSpeed);
    });

    it('lasts initialDashFrames, then turns into a run while the stick stays held', () => {
      const frames = play(standing(), hold(RIGHT, FIGHTER.initialDashFrames + 1));
      const actions = frames.map((s) => fighter(s, 0).action);
      expect(actions.slice(0, FIGHTER.initialDashFrames)).toEqual(
        hold(RIGHT, FIGHTER.initialDashFrames).map(() => 'dash'),
      );
      expect(actions[FIGHTER.initialDashFrames]).toBe('run');
    });

    it('covers dashSpeed per frame of the dash', () => {
      const start = standing();
      const end = last(play(start, hold(RIGHT, FIGHTER.initialDashFrames)));
      const travelled = fighter(end, 0).position.x - fighter(start, 0).position.x;
      expect(travelled).toBeCloseTo(FIGHTER.dashSpeed * FIGHTER.initialDashFrames);
    });

    it('plays out when the stick is let go, then stands', () => {
      const frames = play(standing(), [RIGHT, ...hold(NONE, FIGHTER.initialDashFrames)]);
      const actions = frames.map((s) => fighter(s, 0).action);
      expect(actions[FIGHTER.initialDashFrames - 1]).toBe('dash');
      expect(actions[FIGHTER.initialDashFrames]).toBe('idle');
    });

    it('stops where the dash ends instead of sliding on while standing', () => {
      const frames = play(standing(), [RIGHT, ...hold(NONE, FIGHTER.initialDashFrames + 10)]);
      const stood = fighter(frames[FIGHTER.initialDashFrames] ?? last(frames), 0);
      expect(stood.velocity.x).toBe(0);
      expect(fighter(last(frames), 0).position.x).toBeCloseTo(stood.position.x);
    });

    it('does not start from a stick pushed slowly: that walks at walkSpeed', () => {
      const frames = play(standing(), [...slowPush(1), ...hold(RIGHT, 30)]);
      expect(frames.every((s) => fighter(s, 0).action !== 'dash')).toBe(true);
      const end = fighter(last(frames), 0);
      expect(end.action).toBe('walk');
      expect(end.velocity.x).toBeCloseTo(FIGHTER.walkSpeed);
    });

    it('walks slower with the stick only partly tilted', () => {
      const end = fighter(
        last(play(standing(), [...slowPush(0.5), ...hold(inputOf({ x: 0.5 }), 30)])),
        0,
      );
      expect(end.action).toBe('walk');
      expect(end.velocity.x).toBeCloseTo(FIGHTER.walkSpeed * 0.5);
    });

    it('can be jumped out of', () => {
      const state = last(play(standing(), [RIGHT, RIGHT, RIGHT, inputOf({ x: 1, jump: true })]));
      expect(fighter(state, 0).action).toBe('jumpsquat');
    });
  });

  describe('dash dance', () => {
    it('turns into a dash the other way on a flick back during the dash', () => {
      const frames = play(standing(), [...hold(RIGHT, 5), LEFT]);
      expect(fighter(last(frames), 0)).toMatchObject({
        action: 'dash',
        actionFrame: 0,
        facing: -1,
      });
      expect(fighter(last(frames), 0).velocity.x).toBeCloseTo(-FIGHTER.dashSpeed);
    });

    it('stays near where it started and never runs while flicking back and forth', () => {
      const start = standing(0);
      const dance = Array.from({ length: 8 }, (_, i) => hold(i % 2 === 0 ? RIGHT : LEFT, 6)).flat();
      const frames = play(start, dance);
      expect(frames.every((s) => fighter(s, 0).action === 'dash')).toBe(true);
      expect(Math.abs(fighter(last(frames), 0).position.x)).toBeLessThan(FIGHTER.dashSpeed * 7);
    });
  });

  describe('run', () => {
    it("reaches the fighter's runSpeed", () => {
      const runner = fighter(running(), 0);
      expect(runner.action).toBe('run');
      expect(runner.velocity.x).toBeCloseTo(FIGHTER.runSpeed);
    });

    it('skids to a stop when the stick is let go, then stands', () => {
      const frames = play(running(), hold(NONE, FIGHTER.skidFrames + 1));
      const actions = frames.map((s) => fighter(s, 0).action);
      expect(actions.slice(0, FIGHTER.skidFrames)).toEqual(
        hold(NONE, FIGHTER.skidFrames).map(() => 'skid'),
      );
      expect(actions[FIGHTER.skidFrames]).toBe('idle');
      expect(fighter(last(frames), 0).velocity.x).toBeCloseTo(0);
    });

    it('also skids when the stick drops below the run threshold', () => {
      const state = step(running(), [inputOf({ x: STICK.run - 0.1 })]);
      expect(fighter(state, 0).action).toBe('skid');
    });

    it('turns around when pushed back, then runs the other way', () => {
      const frames = play(running(), hold(LEFT, FIGHTER.skidFrames + 30));
      const turning = frames.slice(0, FIGHTER.skidFrames).map((s) => fighter(s, 0));
      expect(turning.every((f) => f.action === 'runTurn' && f.facing === 1)).toBe(true);
      expect(fighter(frames[FIGHTER.skidFrames] ?? last(frames), 0)).toMatchObject({
        action: 'run',
        facing: -1,
      });
      expect(fighter(last(frames), 0).velocity.x).toBeCloseTo(-FIGHTER.runSpeed);
    });

    it('stands facing the other way when the stick is let go during the turnaround', () => {
      const frames = play(running(), [LEFT, ...hold(NONE, FIGHTER.skidFrames)]);
      expect(fighter(last(frames), 0)).toMatchObject({ action: 'idle', facing: -1 });
    });

    it('can attack out of a run', () => {
      const state = step(running(), [inputOf({ x: 1, attack: true })]);
      expect(fighter(state, 0).action).toBe('attack');
    });
  });

  describe('pivot', () => {
    it('turns in place on a dash back on the first frame of the dash', () => {
      const start = standing();
      const frames = play(start, [RIGHT, LEFT]);
      const pivoted = fighter(last(frames), 0);
      expect(pivoted).toMatchObject({ action: 'idle', facing: -1 });
      expect(pivoted.velocity.x).toBe(0);
      expect(pivoted.position.x).toBeCloseTo(fighter(start, 0).position.x + FIGHTER.dashSpeed);
    });

    it('lets a smash come out facing the other way', () => {
      const state = last(play(standing(), [RIGHT, LEFT, inputOf({ x: -1, attack: true })]));
      expect(fighter(state, 0)).toMatchObject({
        action: 'attack',
        moveId: CAPSULE.moves.forwardSmash,
        facing: -1,
      });
    });

    it('is a dash dance instead from the second frame of the dash on', () => {
      const state = last(play(standing(), [RIGHT, RIGHT, LEFT]));
      expect(fighter(state, 0)).toMatchObject({ action: 'dash', facing: -1 });
    });
  });

  describe('per fighter', () => {
    it('lets every fighter dash and run faster than it walks', () => {
      for (const stats of [FIGHTER, RIVET_STATS, VELA_STATS]) {
        expect(stats.initialDashFrames).toBeGreaterThan(0);
        expect(stats.skidFrames).toBeGreaterThan(0);
        expect(stats.dashSpeed).toBeGreaterThan(stats.walkSpeed);
        expect(stats.runSpeed).toBeGreaterThan(stats.walkSpeed);
      }
    });

    it('lets light Vela outrun Rivet', () => {
      const vela = fighter(running(VELA.id, VELA_STATS), 0);
      const rivet = fighter(running(RIVET.id, RIVET_STATS), 0);
      expect(vela.velocity.x).toBeCloseTo(VELA_STATS.runSpeed);
      expect(rivet.velocity.x).toBeCloseTo(RIVET_STATS.runSpeed);
      expect(vela.velocity.x).toBeGreaterThan(rivet.velocity.x);
    });
  });
});
