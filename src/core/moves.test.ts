import { describe, expect, it } from 'vitest';
import { activeHitboxes } from './combat';
import { movePose, POSES } from './poses';
import { HUMANOID, plantedBoneSegments } from './skeleton';
import { MOVES, findMove } from './move-data';
import { moveTiming, validateMove, type HitboxAnchor, type MoveDef } from './moves';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';
import type { MatchState } from './types';

const JAB = findMove('jab');

describe('move data', () => {
  it('puts the jab on the front fist, with the arm behind it as a weaker hit', () => {
    expect(moveTiming(JAB)).toEqual({ startupFrames: 3, activeFrames: 3, totalFrames: 18 });
    expect(JAB.hitboxes.map((hitbox) => [hitbox.anchor, hitbox.priority, hitbox.damage])).toEqual([
      [{ bone: 'lowerArmFront', at: 1 }, 1, 6],
      [{ bone: 'upperArmFront', at: 1 }, 0, 4],
    ]);
    // The fist is extended before its hitbox turns on.
    expect(JAB.poses[0]?.frame).toBeLessThanOrEqual(moveTiming(JAB).startupFrames);
  });

  it('accepts every registered move and is plain data', () => {
    for (const move of Object.values(MOVES)) expect(() => validateMove(move)).not.toThrow();
    expect(JSON.parse(JSON.stringify(MOVES))).toEqual(MOVES);
  });

  it('refuses a move whose hitbox windows do not fit its frames', () => {
    const broken = (patch: Partial<MoveDef['hitboxes'][number]>): MoveDef => ({
      ...JAB,
      hitboxes: JAB.hitboxes.map((hitbox) => ({ ...hitbox, ...patch })),
    });
    expect(() => validateMove(broken({ from: 6, to: 3 }))).toThrow(/jab/);
    expect(() => validateMove(broken({ to: 40 }))).toThrow(/jab/);
    expect(() => validateMove(broken({ from: -1 }))).toThrow(/jab/);
    expect(() => validateMove(broken({ radius: 0 }))).toThrow(/jab/);
    expect(() => validateMove(broken({ group: -1 }))).toThrow(/jab/);
    expect(() => validateMove(broken({ hitlagScale: -1 }))).toThrow(/jab/);
    expect(() => validateMove(broken({ hitlagScale: Infinity }))).toThrow(/jab/);
    expect(() => validateMove({ ...JAB, totalFrames: 0 })).toThrow(/jab/);
  });

  it('refuses a hitbox on a bone the skeleton does not have, or off the bone', () => {
    const on = (anchor: unknown): MoveDef => ({
      ...JAB,
      hitboxes: JAB.hitboxes.map((hitbox) => ({ ...hitbox, anchor: anchor as HitboxAnchor })),
    });
    expect(() => validateMove(on({ bone: 'tail', at: 0.5 }))).toThrow(/tail/);
    expect(() => validateMove(on({ bone: 'lowerArmFront', at: 1.5 }))).toThrow(/jab/);
    expect(() => validateMove(on({ bone: 'lowerArmFront', at: -0.1 }))).toThrow(/jab/);
  });

  it('refuses pose keyframes that are missing, out of order, or come after the first hit', () => {
    const first = JAB.poses[0];
    if (!first) throw new Error('The jab has keyframes');
    const keyed = (poses: MoveDef['poses']): MoveDef => ({ ...JAB, poses });
    expect(() => validateMove(keyed([]))).toThrow(/jab/);
    expect(() =>
      validateMove(
        keyed([
          { ...first, frame: 5 },
          { ...first, frame: 4 },
        ]),
      ),
    ).toThrow(/jab/);
    expect(() => validateMove(keyed([{ ...first, frame: 4 }]))).toThrow(/jab/);
    expect(() => validateMove(keyed([{ ...first, frame: JAB.totalFrames }]))).toThrow(/jab/);
  });

  it('refuses an unknown move id', () => {
    expect(() => findMove('teleport-punch')).toThrow(/teleport-punch/);
    // Names every object inherits are not moves either.
    expect(() => findMove('toString')).toThrow(/toString/);
    expect(() => findMove('constructor')).toThrow(/constructor/);
  });
});

describe('move runner', () => {
  const attack = [inputOf({ attack: true }), inputOf({})];

  it('plays the jab when attack is pressed, then returns to standing', () => {
    let state = run(settled(), 1, attack);
    expect(fighter(state, 0).action).toBe('attack');
    expect(fighter(state, 0).moveId).toBe('jab');
    state = run(state, JAB.totalFrames);
    expect(fighter(state, 0).action).toBe('idle');
    expect(fighter(state, 0).moveId).toBeNull();
  });

  /** Fighter 0 on `actionFrame` of the jab, in the pose the move has on that frame. */
  const jabbing = (actionFrame: number, facing: 1 | -1, pose = movePose(JAB, actionFrame)) =>
    fighter(
      withFighter(settled(), 0, {
        action: 'attack',
        moveId: 'jab',
        actionFrame,
        facing,
        position: { x: 1, y: 2 },
        pose,
      }),
      0,
    );

  it('turns the hitboxes on only during their active frames', () => {
    const timing = moveTiming(JAB);
    expect(activeHitboxes(jabbing(timing.startupFrames - 1, 1))).toEqual([]);
    expect(activeHitboxes(jabbing(timing.startupFrames, 1))).toHaveLength(2);
    expect(activeHitboxes(jabbing(timing.startupFrames + timing.activeFrames, 1))).toEqual([]);
  });

  it('puts a bone hitbox on its bone, on the body as drawn, mirrored by facing', () => {
    const frame = moveTiming(JAB).startupFrames;
    for (const facing of [1, -1] as const) {
      const body = jabbing(frame, facing);
      const bones = plantedBoneSegments(HUMANOID, body.pose, body.position, facing);
      const [fist, elbow] = activeHitboxes(body).map((hitbox) => hitbox.center);
      expect(fist).toEqual(bones.lowerArmFront.end);
      expect(elbow).toEqual(bones.upperArmFront.end);
    }
    const reach = (facing: 1 | -1) =>
      (activeHitboxes(jabbing(frame, facing))[0]?.center.x ?? 1) - 1;
    expect(reach(1)).toBeGreaterThan(0.5);
    expect(reach(-1)).toBeCloseTo(-reach(1), 9);
  });

  it('follows the keyframes exactly from the first one, whatever the body did before', () => {
    const first = JAB.poses[0]?.frame ?? 0;
    const frame = moveTiming(JAB).startupFrames;
    // Started from a run or from the stance, the fist ends up in the same place.
    const fromRun = run(withFighter(settled(), 0, { pose: POSES.run }), 1, attack);
    const fromStance = run(settled(), 1, attack);
    const at = (state: MatchState) =>
      run(state, frame, [inputOf({})]).fighters[0]?.pose ?? POSES.idle;
    expect(at(fromRun)).toEqual(at(fromStance));
    expect(at(fromStance)).toEqual(movePose(JAB, frame));
    // Before the first keyframe the body eases towards it, so it does not snap on frame 0.
    const start = fighter(fromRun, 0);
    expect(start.actionFrame).toBeLessThan(first);
    expect(start.pose).not.toEqual(movePose(JAB, first));
    expect(start.pose).not.toEqual(POSES.run);
  });

  it('forgets the move when a fighter is knocked out of the match mid-attack', () => {
    const lastStock = withFighter(settled(), 0, {
      action: 'attack',
      moveId: 'jab',
      stocks: 1,
      position: { x: 0, y: -100 },
    });
    const out = fighter(run(lastStock, 1), 0);
    expect(out.action).toBe('eliminated');
    expect(out.moveId).toBeNull();
  });
});
