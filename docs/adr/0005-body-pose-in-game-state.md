# 0005 Body pose is part of the game state

- Status: Accepted
- Date: 2026-10-01

## Context

Fighters now have a skeleton (#22) and poses per movement state (#24). Next, hurtboxes follow the
bones (#25), and from Sprint 3 hitboxes attach to bones too. Whatever decides where a body part is
must therefore give the same answer on every machine that runs `step`, including a future server.

## Decision

The body pose is simulation state: `FighterState.pose` holds the joint angles, and `step` eases them
each frame towards the pose of the fighter's movement state (`poses.ts`), before combat runs.

- Poses are plain data (degrees per bone), kept within -180..180 and blended the short way round.
- Easing is a fixed share per frame (`POSE.blend`), so switches never pop and the result is a pure
  function of the previous state.
- Idle breathing is driven by the match frame, the running stride by `actionFrame`: no clocks.
- The view only interpolates between the last two poses, as it does for positions.
- With the move engine (S3), an attack's keyframed poses will replace the eased target while the
  move runs; the eased pose stays the fallback for movement states.

## Consequences

- Hurtboxes and bone-attached hitboxes use exactly the body that is drawn: the planted one from
  `plantedBoneSegments`, with the feet on the fighter's position.
- Snapshots and replays carry ten more numbers per fighter.
- Hit detection now depends on `Math.sin` and `Math.cos`. ADR 0003 already notes these may differ
  across browsers and CPUs; that question must be answered before peer-to-peer rollback.

## Alternatives considered

- Pose computed only in the view: simplest, but hurtboxes could not follow it without the view
  deciding gameplay.
- Pose derived each frame from state without easing: deterministic too, but switches pop, and
  blending would have to live in the view, out of reach of hurtboxes.
