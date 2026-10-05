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
  - a move slot (#28, which reads tilt or smash at that moment), or `dodge` (split into
    `spotDodge` and `roll` in #35) or `block`
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
- **Landing.** An aerial ends when the fighter lands, and the fighter goes into its landing lag
  (see the #34 amendment below).
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
type BufferedAction = MoveSlot | 'spotDodge' | 'roll' | 'airDodge' | 'block'; // superseded, see the amendments

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

type MoveDef = AttackMoveDef; // block and counter became fields instead (#50, #51)
```

### Amendment (2026-10-01, #31)

- The buffer also stores the way the move will face, fixed at the press:
  `{ action, face, age }`. A ground attack aimed behind turns around (#28), and the fighter may
  turn between the press and the move's start.
- A press during hitlag goes into the buffer like any other press. The previous input moves on
  with each frame, so a button held through the freeze is not a second press.
- A press for an empty slot is dropped at once, so it does not block a jump on the same frame.
- An aerial press still in the buffer when the fighter lands is dropped (decided in #34).

### Amendment (2026-10-01, #34)

- **Landing lag.** An `AttackMoveDef` may set `landingLag` (at least one frame). Such a move is
  an aerial: landing while it runs ends it, and the fighter enters the `landing` action for that
  many frames, counted down in `FighterState.landingLagFrames`. A move without `landingLag`
  keeps running on landing.
- Landing from `airborne` costs `FIGHTER.landingLagFrames` (since #37 the character's
  `stats.landingLagFrames`); a fighter in hitstun lands without
  lag. Presses during the lag wait in the buffer as usual. Sliding off an edge during the lag
  ends it, and the fighter falls under control.
- An aerial started on the frame before landing still costs its full landing lag, as in Melee
  (superseded by the #148 amendment: its first frames are an auto-cancel window).
- An aerial press still in the buffer on landing is dropped, so no aerial plays on the ground.
- During an aerial the fighter drifts with the stick and can fast-fall, like `airborne`.

### Amendment (2026-10-02, #35)

- **Dodges.** `dodge` splits into `spotDodge` and `roll`. The dodge button turns into one of them
  at the press, like an attack into its slot; the buffer's `face` is the way the fighter faces
  when the dodge starts (for a roll, away from where it travels; superseded by the dodge-rework
  amendment below).
- Dodges are fighter actions with shared frame data (`DODGE` in `config.ts`), not `MoveDef`s:
  they have no hitboxes, and every character dodges alike for now. If dodges ever differ per
  character, they become a move kind.
- Invulnerability reuses `invulnerableFrames`: a dodge keeps it at one or more on its
  invulnerable frames, so combat and the view need no dodge-specific code.
- A dodge press is dropped when the fighter is in the air (until #36). A cancel window `on` a
  dodge is not played yet; dodge cancels come with the first move that uses them (#6).

### Amendment (2026-10-02, #36)

- **Air dodge.** In the air the dodge button buffers `airDodge`, a third dodge action with its
  frame data in `DODGE.air`, Ultimate style: the stick's direction is read when it starts, and
  the fighter can act once it ends.
- It is used once per airtime: `FighterState.airDodgeUsed` is set when it starts and cleared on
  landing and on being hit. A press while it is used up is dropped, as is an air dodge still in
  the buffer on landing.
- During the whole air dodge the fighter neither drifts nor fast-falls. Landing at any point of
  it, also while falling after `DODGE.air.moveTo`, ends it with `DODGE.air.landingLag`, keeping
  the horizontal speed, so an air dodge angled into the ground slides.
- A dodge pressed during the jump squat is an air dodge once the jump leaves the ground, as in
  Ultimate (jump, then dodge angled down slides along the ground).
- Passing through a platform follows the stick held at that moment, as for any fall: an air
  dodge angled down onto a platform with the stick still held drops through it.

### Amendment (2026-10-02, dodge rework)

- The `roll` action splits into `forwardRoll` and `backRoll`. A buffered `roll` press now stores
  the way it travels in `face`. A roll towards the facing is a forward roll and turns around at
  its end, as in Melee; a roll away from it is a back roll and keeps the facing.
- `FighterState.turnedFrom` keeps the facing from before a turn the stick made in the last
  `DODGE.turnGraceFrames`, and a roll counts from it, so a direction key that lands a frame
  before the dodge key still gives a back roll.
- Dodges move the body out of the stage plane in the view only (`dodgeDepth`), back on it when
  the invulnerability ends; the F2 overlay follows the body's depth. Core and hurtboxes stay on
  the 2D plane.
- Roll and air dodge poses are upright instead of curled. Hurtboxes follow poses, so these
  dodges are now about as tall as standing and easier to punish in their recovery.
- Turning the stick back to the facing from before the last turn undoes it, so a quick wiggle
  still gives a back roll. A turn followed within the grace frames by a roll the new way is a
  back roll from the old facing, not a forward roll.

### Amendment (2026-10-02, sidestep, roll and jump buffer)

- The spot dodge becomes a sidestep out of the stage plane, `sidestepIn` (stick up or centred)
  or `sidestepOut` (stick down), sharing `DODGE.sidestep`. A roll needs the stick more sideways
  than up or down. The view moves a sidestep in depth, somersaults a roll and spins an air dodge
  (`dodgeMotion`); rolls no longer leave the stage plane. A roll stands up for its recovery.
- A jump press is a `BufferedAction` (`'jump'`), so a double jump pressed during an aerial or air
  dodge comes out when it ends. A second press during the jump squat is dropped at take-off, and
  a jump press with none left is dropped. A jump never replaces a waiting move or dodge, is not
  buffered in hitstun (jumping out of hitstun needs a fresh press, as in Melee), and landing drops
  it.
- Weak attacks recover sooner: jab and jab 2 last 14 frames, jab 3 22, the tilts 17 to 18.

### Amendment (2026-10-03, #44)

- **Helpless.** An `AttackMoveDef` may set `helpless: true` (a recovery move). If it ends with
  the fighter in the air, the fighter enters the `helpless` action instead of `airborne`: it
  drifts at `HELPLESS.drift` of its air speed and cannot fast-fall, jump, attack or dodge. It
  ends on landing (with `HELPLESS.landingLagFrames`), on a ledge grab or on a hit. Used on the
  ground, the move ends as any other.
- Unlike landing lag, helpless keeps no presses: the buffer is cleared every frame, so nothing
  pressed while helpless comes out on landing.
- A helpless move has no cancels (`validateMove` refuses them), so a chain cannot end with full
  control.

### Amendment (2026-10-03, #39)

- **Motion.** An `AttackMoveDef` may list `motion` keys: on a key's `frame` the runner sets the
  fighter's speed, `x` the way it faces and `y` upward, and leaves a part the key leaves out
  alone. Physics carries on from there (friction, gravity, and drift for a move with
  `landingLag`). An upward speed takes a grounded fighter off the ground, using up its ground
  jump; a downward one is ignored on the ground. Keys sit in order on frames 1 to
  `totalFrames - 1`, since frame 0 is the frame the move starts. This is what lets a special
  lunge or rise; Rivet's haymaker and spring jack use it.
- **Recovery moves in the air.** A `helpless` move with `landingLag` drifts like an aerial but
  does not fast-fall, and once falling it catches a free ledge before it ends, as up specials
  snap to ledges in Smash.

### Amendment (2026-10-03, #45)

- **Spawns.** An `AttackMoveDef` may list `spawns`: on a spawn's `frame` (1 to
  `totalFrames - 1`, like motion) an object starts at `offset` from the feet with `velocity`,
  both mirrored by facing, and lives for `lifetime` frames. It carries a copy of its `hit`
  (`HitDef`: damage, angle, knockback, hitlag scale), so the object needs no reference back to
  the move and stays valid after the move ends. `HitboxDef` extends the same `HitDef`.
- Objects live in `MatchState.objects`, not in a fighter, since they outlive the move and even
  the owner's stock. They never hit their owner; a hit uses them up and freezes only the target.

### Amendment (2026-10-03, #46)

- **Behaviours.** A spawn may set `behavior`: `straight` (the default), `arc` with its own
  `gravity`, `trap` with `armFrames`, or `return` with `turnFrames`. The object keeps a copy, and
  its `launchVelocity`, so each frame follows from its own data plus, for a returning object,
  where its owner is. A new behaviour is a new case in `ObjectBehavior`, validated in
  `validateMove` and moved in `objects.ts`.

### Amendment (2026-10-03, #47)

- **Effects.** An `AttackMoveDef` may list `effects` (`EffectKey`: an `EffectId`, an anchor, and
  frames `[from, to)`), and a `SpawnDef` may name an `effect` its object trails. Effect ids are
  plain strings: core never interprets them, so move data can ask for fire without core
  depending on how fire is drawn. A test in the view checks that every id the move data names has
  a look.

### Amendment (2026-10-04, #50)

- **Block as a field, not a kind.** A block is an `AttackMoveDef` with no hitboxes and a `guard`
  (`GuardDef`: a frame window, an optional `hold` frame, `damageScale`, `pushback`,
  `breakDamage`, `breakStun`), instead of a `'block'` variant of `MoveDef`. Poses, cancels,
  timing and the move runner then work for blocks unchanged, and a move could guard and hit at
  once later (armour). `kind` stays `'attack'` for now.
- **Counter (#51)** is the same pattern: an optional `counter` (`CounterDef`: a frame window and
  the move it goes `into`). A move cannot both guard and counter, and `into` must name a known
  move, as a cancel's does.
- Block and counter sit in the character's `downSpecial` slot, so a cancel names them as
  `downSpecial` (#52). The `'block'` buffered action is gone.

### Amendment (2026-10-04, #52)

- **Dodge as a cancel target.** `CancelDef.on` may be `'dodge'`: in that window any buffered
  dodge that can start (sidestep or roll on the ground, air dodge in the air) cuts the move short.
  Such a cancel names no `into`.

### Amendment (2026-10-04, #49)

- **Spawn limit.** An `AttackMoveDef` with spawns may set `spawnLimit`: at most that many of the
  move's objects per fighter at once, and a new one removes that fighter's oldest (Vela's one
  mine). To count them, a `SpawnedObject` records the `moveId` that spawned it. The limit is per
  move, not per spawn, since a move with several spawns is one attack.

### Amendment (2026-10-04, #147)

- A jump press from the short hop button (`PlayerInput.shortHop`) is the same buffered `'jump'`,
  marked `shortHop: true`; a ground jump from it leaves at the character's `shortHopVelocity`.
  `FighterState.shortHop` carries the choice through the jump squat. Pressed together with jump,
  the full jump wins.

### Amendment (2026-10-04, #148)

- An aerial may have `autoCancel: { before, after }`. Landing on frames `[0, before)` or
  `[after, totalFrames)` costs only the character's normal landing lag; landing in between costs
  the aerial's `landingLag`. This replaces the rule that an aerial started on the frame before
  landing costs its full landing lag. The windows must stay clear of the hitboxes, and only a move with a
  `landingLag` may have them. Recovery moves keep none and always land with their own lag.
- The capsule's aerial landing lags are shorter for the faster tempo: nair 6, back air and up
  air 9, forward air 12, down air 15 (the punishable one).

### Amendment (2026-10-05, #153)

- Knockback follows Melee's formula. `baseKnockback` and `knockbackGrowth` are in Melee's units
  (base in knockback units, growth in percent), and a character's `weight` is on Melee's scale
  (capsule and Rivet 100, Vela 70). Knockback is
  `((p / 10 + p * d / 20) * 200 / (weight + 100) * 1.4 + 18) * growth / 100 + base`, with `p` the
  target's percent after the hit and `d` the hit's damage. Hitstun is `floor(knockback * 0.4)`.
- A launch is `knockback * KNOCKBACK.speedPerUnit` stage units per frame. It lives in
  `FighterState.knockback`, which is part of `velocity`, and shrinks by
  `KNOCKBACK.decayPerFrame` along its direction each frame; gravity, fall speed and drift act on
  the rest of `velocity`, the fighter's own speed. The two constants are Melee's, scaled by the
  capsule's gravity against Mario's, so faster fallers drop out of a launch sooner. The ground
  stops a launch's fall but not its slide.
- From `KNOCKBACK.tumbleFrom` (80) on, the target tumbles (`FighterState.tumbling`) until it acts
  or lands; below it, it flinches. Both can act once hitstun is over.
- Every move was retuned to the new units. The #42 KO windows still hold.

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
- Not covered yet: armour and clashes (projectiles came with #45).
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
