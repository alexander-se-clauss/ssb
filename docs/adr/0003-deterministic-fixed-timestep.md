# 0003 Deterministic fixed-timestep simulation

- Status: Accepted
- Date: 2026-09-30

## Context

Fighting games need consistent timing: a move must take the same number of frames on every
machine. Online play (server authority with prediction, or rollback) needs to re-run the
simulation from past states and get identical results.

## Decision

The simulation advances in fixed ticks of 1/60 s via `FixedStepClock`, independent of the
display rate. `step(state, inputs)` is a pure function over plain data. Rendering interpolates
between the last two states.

## Consequences

- Frame data (startup, active, recovery) is exact and testable.
- Replays are just the initial state plus a list of inputs.
- We must keep wall-clock time and unseeded randomness out of core.
- JavaScript floats are deterministic on one engine, but not guaranteed across browsers and
  CPUs for all operations (e.g. `Math.sin`). Before peer-to-peer rollback we will revisit this:
  options are fixed-point math or server authority.

## Alternatives considered

- Variable timestep (`dt` per render frame): simpler, but frame data varies with frame rate and
  replays diverge.
- Physics engine (Rapier, cannon-es): realistic, but platform fighters use bespoke kinematic
  physics, and engines make determinism and serialization harder.
