# 0006 Moves are plain data run by one move runner

- Status: Accepted
- Date: 2026-10-01

## Context

Sprint 3 (#5) turns the hard-coded M0 jab into a move engine. Later sprints add tilts, smashes,
aerials and specials (S4, S6), and also block and counter moves (#6). Every move needs the same
things:

- frame timing
- hitboxes that follow a bone (#29)
- damage and knockback, with hitlag (#30)
- windows to cancel into other actions, with an input buffer (#31)
- a pose track for the body (ADR 0005)

Moves must run identically on a future server and in rollback replays, so the definitions and the
state they create must be deterministic and plain serializable data (architecture rule 5). Adding
or tuning a move should not need new code.

## Decision

A move is a `MoveDef` of plain data, and one generic move runner in core plays any of them.

- **Timing.** A move counts frames from 0 to `totalFrames`. Startup, active and recovery are
  derived from the hitbox windows (before the first, while any is on, after the last), not stored.
- **Hitboxes.** A hitbox is a circle with an anchor:
  - On a bone, at a point from 0 (the bone's start) to 1 (its end), on the planted body
    (ADR 0005).
  - Or relative to the feet, with x mirrored by facing.

  A hitbox is on during `[from, to)`. A target is hit at most once per hitbox `group`. Every hitbox
  is in group 0 unless it says otherwise, so a move hits once by default, and a multi-hit move
  gives each hit its own group. When several of one attacker's hitboxes touch a target on the same
  frame, the highest `priority` wins, then list order. Clashes between two attacks are out of
  scope: trades stay symmetric, as today.

- **Knockback and hitlag.** Each hitbox carries its damage, angle, base knockback and growth.
  Hitlag frames come from damage by one formula in `config.ts`, times an optional `hitlagScale`.
  - On a hit, attacker and target both get `hitlagFrames`. The target's launch velocity is set
    then, but held.
  - While `hitlagFrames > 0`, a fighter does not move, and its move frame and pose stand still.
  - Its buffered input is kept and does not age.
- **Input buffer and cancels.** A press is turned into what it asks for at once:
  - a move slot (#28, which reads tilt or smash at that moment), or `dodge` or `block`
  - it is stored as `FighterState.buffer = { action, age }`, and is dropped after
    `INPUT.bufferFrames`
  - a move's `cancels` list says which of these actions it accepts, and on which frames
  - a cancel can name the move to go into (the next jab); without one, the character's slot
    mapping decides.
- **Poses.** `poses` holds keyframes:
  - Before the first keyframe, the body eases towards it as movement poses do.
  - From the first keyframe on, the pose follows the keyframes exactly, interpolated linearly
    between them.
  - Validation requires the first keyframe at or before the first hitbox frame, so a bone
    hitbox's reach on its active frames is fixed per move.
- **Landing.** An aerial ends when the fighter lands, and the fighter goes to idle. Landing lag
  comes in S4.
- **Kinds.** `kind` is `'attack'` for now. `'block'` and `'counter'` will be added as further
  variants of the union, each with its own fields (#6), so the runner switches on `kind`.
- **Where.**
  - Types and the runner live in `src/core/moves.ts`, and move data lives in
    `src/core/move-data/`.
  - Characters map move slots to move ids.
  - `FighterState` stores only `moveId`, the move frame, the hit targets per group,
    `hitlagFrames` and `buffer`, never the definition.
  - Definitions are validated on load, as stage ids are: frames in range, known bones, sorted
    keyframes.

```ts
type MoveId = string;
type MoveSlot = 'jab' | 'forwardTilt' | 'upSmash' | 'neutralAir' | 'upSpecial'; // ... all in #28
type BufferedAction = MoveSlot | 'dodge' | 'block';

type HitboxAnchor = { readonly bone: BoneId; readonly at: number } | { readonly feet: Vec2 };

interface HitboxDef {
  readonly anchor: HitboxAnchor;
  readonly radius: number;
  readonly from: number; // first active frame
  readonly to: number; // first frame after it
  readonly group?: number; // default 0: one hit per target per group
  readonly priority: number;
  readonly damage: number;
  readonly angle: number; // degrees, 0 = forward, 90 = up
  readonly baseKnockback: number;
  readonly knockbackGrowth: number;
  readonly hitlagScale?: number; // default 1
}

interface CancelDef {
  readonly on: BufferedAction;
  readonly into?: MoveId; // e.g. jab 1 -> jab 2; otherwise the character's slot mapping
  readonly from: number;
  readonly to: number;
}

interface PoseKey {
  readonly frame: number;
  readonly pose: Pose;
}

interface AttackMoveDef {
  readonly kind: 'attack';
  readonly id: MoveId;
  readonly totalFrames: number;
  readonly hitboxes: readonly HitboxDef[];
  readonly cancels: readonly CancelDef[];
  readonly poses: readonly PoseKey[];
}

type MoveDef = AttackMoveDef; // | BlockMoveDef | CounterMoveDef with #6
```

## Consequences

- New moves are data. Tests, tools and an AI agent can write and check them without new code.
- **#27, the first step:** the jab becomes a `MoveDef` with a feet anchor at the M0 values (0.75,
  0.9, radius 0.45), so it hits exactly as before.
  - The combat tests keep every assertion. Only their setup changes: they read the jab's
    numbers from its move definition instead of `JAB`, and set `moveId` instead of
    `action: 'jab'`.
  - `AttackDef` and `JAB` go away.
- **#29:** the jab moves to its fist. The hurtbox tests that depend on exact distances are then
  retuned against the new reach.
- The pose track decides how far a bone hitbox reaches, so tuning a move includes tuning its
  poses. The F2 overlay (#32) is the tool to check that.
- More state per fighter, all plain data: the move, hit targets per group, hitlag and the buffer.
- Once moves land, the "Terms" paragraph in `docs/architecture.md` must be updated:
  `activeHitbox` becomes a list of bone hitboxes, and `'jab'` leaves `FighterAction`.
- Not covered yet: movement during a move (lunges), landing lag, armour, clashes and projectiles.
  They come as optional fields or new kinds when a move needs them.

## Alternatives considered

- **Moves as code (a function or state machine per move).** Flexible, but not serializable, hard
  to validate, and every move becomes custom logic.
- **Stored startup, active and recovery fields.** Simple for one hit, but cannot express multi-hit
  moves or hitboxes that start on different frames.
- **Easing towards each keyframe for the whole move.** Smooth, but the reach on active frames
  would depend on what the fighter did before the move.
- **Hitboxes only relative to the feet.** This is the M0 approach. It cannot follow a fist or a
  foot, which is what #29 asks for.
- **Moves in JSON files loaded at runtime.** Possible later, because the data is plain. For now,
  typed TypeScript modules catch mistakes at compile time.
