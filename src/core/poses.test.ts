import { describe, expect, it } from 'vitest';
import { HITSTUN_PER_KNOCKBACK, POSE } from './config';
import { NEUTRAL_INPUT, inputOf } from './input';
import { BONE_IDS, REST_POSE, type Pose } from './skeleton';
import { POSES, blendPose, poseName, shortestTurn, targetPose, type PoseName } from './poses';
import { fighter, newMatch, run, settled, withFighter } from './test-helpers';
import { step } from './simulation';
import type { FighterState, MatchState, PlayerInput } from './types';

/** The largest joint difference between two poses, the short way round. */
const biggestChange = (a: Pose, b: Pose): number =>
  Math.max(...BONE_IDS.map((bone) => Math.abs(shortestTurn(a[bone], b[bone]))));

const TUMBLE_HITSTUN = Math.round(POSE.tumbleSpeed * HITSTUN_PER_KNOCKBACK);

/** Puts fighter 0 into hitstun as a hit of `hitstunFrames` would. */
const hit = (state: MatchState, hitstunFrames: number): MatchState =>
  withFighter(state, 0, {
    action: 'hitstun',
    actionFrame: 0,
    hitstunFrames,
    grounded: false,
    velocity: { x: 0.3, y: 0.3 },
  });

describe('poses for movement states', () => {
  it('picks a pose from what the fighter is doing', () => {
    const standing = fighter(settled(), 0);
    expect(poseName(standing)).toBe('idle');
    expect(poseName({ ...standing, action: 'run' })).toBe('run');
    expect(poseName({ ...standing, action: 'jab' })).toBe('jab');
    const air = { ...standing, action: 'airborne' as const, grounded: false };
    expect(poseName({ ...air, velocity: { x: 0, y: 0.2 } })).toBe('jump');
    expect(poseName({ ...air, velocity: { x: 0, y: -0.1 } })).toBe('fall');
    const stunned: FighterState = { ...standing, action: 'hitstun', actionFrame: 0 };
    expect(poseName({ ...stunned, hitstunFrames: TUMBLE_HITSTUN - 1 })).toBe('hurt');
    expect(poseName({ ...stunned, hitstunFrames: TUMBLE_HITSTUN })).toBe('tumble');
  });

  it('gives every movement state its own pose', () => {
    const names = Object.keys(POSES) as PoseName[];
    for (const a of names) {
      for (const b of names)
        if (a !== b) expect(biggestChange(POSES[a], POSES[b])).toBeGreaterThan(5);
    }
  });

  it('reaches the pose of each state the game puts the fighter in', () => {
    const scenarios: readonly [PoseName, MatchState, PlayerInput[]][] = [
      ['idle', settled(), Array<PlayerInput>(30).fill(NEUTRAL_INPUT)],
      ['run', settled(), Array<PlayerInput>(12).fill(inputOf({ x: 1 }))],
      ['jump', settled(), [inputOf({ jump: true }), ...Array<PlayerInput>(14).fill(NEUTRAL_INPUT)]],
      ['fall', settled(), [inputOf({ jump: true }), ...Array<PlayerInput>(40).fill(NEUTRAL_INPUT)]],
      [
        'jab',
        settled(),
        [inputOf({ attack: true }), ...Array<PlayerInput>(12).fill(NEUTRAL_INPUT)],
      ],
      ['hurt', hit(settled(), TUMBLE_HITSTUN - 1), Array<PlayerInput>(12).fill(NEUTRAL_INPUT)],
      ['tumble', hit(settled(), TUMBLE_HITSTUN + 20), Array<PlayerInput>(12).fill(NEUTRAL_INPUT)],
    ];
    for (const [name, start, inputs] of scenarios) {
      const end = inputs.reduce((state, input) => step(state, [input]), start);
      const body = fighter(end, 0);
      expect(poseName(body), name).toBe(name);
      expect(biggestChange(body.pose, targetPose(body, end.frame)), name).toBeLessThan(10);
    }
  });

  it('keeps a tumble a tumble while the launch slows down', () => {
    let state = hit(settled(), TUMBLE_HITSTUN + 5);
    while (fighter(state, 0).action === 'hitstun') {
      expect(poseName(fighter(state, 0))).toBe('tumble');
      state = step(state, []);
    }
  });

  it('keeps an idle fighter breathing and swaying instead of standing still', () => {
    const standing = fighter(settled(), 0);
    // A quarter and three quarters into a breath: fully in, then fully out.
    const now = targetPose(standing, POSE.idleCycleFrames / 4);
    const later = targetPose(standing, (POSE.idleCycleFrames * 3) / 4);
    expect(biggestChange(now, later)).toBeGreaterThan(1);
    // Gentle: it never strays far from the idle pose.
    for (let frame = 0; frame < POSE.idleCycleFrames; frame += 5) {
      expect(biggestChange(targetPose(standing, frame), POSES.idle)).toBeLessThan(10);
    }
  });

  it('swings the legs in opposite directions while running', () => {
    const running = { ...fighter(settled(), 0), action: 'run' as const, actionFrame: 0 };
    const quarter = Math.round(POSE.runCycleFrames / 4);
    const stride = targetPose({ ...running, actionFrame: quarter }, 0);
    const front = shortestTurn(POSES.run.upperLegFront, stride.upperLegFront);
    const back = shortestTurn(POSES.run.upperLegBack, stride.upperLegBack);
    expect(Math.sign(front)).toBe(-Math.sign(back));
    expect(Math.abs(front)).toBeGreaterThan(10);
  });
});

describe('blending between poses', () => {
  it('never moves a joint far in one frame, through every state switch', () => {
    const names = Object.keys(POSES) as PoseName[];
    const widest = Math.max(
      ...names.flatMap((a) => names.map((b) => biggestChange(POSES[a], POSES[b]))),
    );
    const script: PlayerInput[] = [
      ...Array<PlayerInput>(20).fill(inputOf({ x: 1 })),
      inputOf({ jump: true }),
      ...Array<PlayerInput>(60).fill(NEUTRAL_INPUT),
      inputOf({ attack: true }),
      ...Array<PlayerInput>(20).fill(NEUTRAL_INPUT),
    ];
    let state = settled();
    let largest = 0;
    for (const input of script) {
      const next = step(state, [input]);
      largest = Math.max(largest, biggestChange(fighter(state, 0).pose, fighter(next, 0).pose));
      state = next;
    }
    // Then a hard hit, the biggest switch of all.
    state = hit(state, TUMBLE_HITSTUN + 20);
    for (let i = 0; i < 20; i += 1) {
      const next = step(state, []);
      largest = Math.max(largest, biggestChange(fighter(state, 0).pose, fighter(next, 0).pose));
      state = next;
    }
    expect(largest).toBeLessThan(0.35 * widest);
  });

  it('turns the short way round between angles on either side of a half turn', () => {
    const from: Pose = { ...REST_POSE, upperArmFront: 170 };
    const to: Pose = { ...REST_POSE, upperArmFront: -170 };
    // Half way from 170 to -170 the short way is 180, not 0.
    expect(Math.abs(blendPose(from, to, 0.5).upperArmFront)).toBeCloseTo(180);
    // Angles stay within one turn, so poses remain comparable.
    for (const angle of Object.values(blendPose(from, to, 0.75))) {
      expect(angle).toBeGreaterThan(-180);
      expect(angle).toBeLessThanOrEqual(180);
    }
  });

  it('carries the pose in the match state as plain data', () => {
    const state = run(withFighter(settled(newMatch()), 0, { pose: POSES.tumble }), 1);
    const pose = fighter(state, 0).pose;
    expect(biggestChange(pose, POSES.tumble)).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(pose))).toEqual(pose);
  });

  it('starts every fighter in the rest pose, so the first frames ease into the state pose', () => {
    expect(fighter(newMatch(), 0).pose).toEqual(REST_POSE);
  });
});
