# 0008 Training mode: dummy and readout in core, pause and settings through a port

- Status: Accepted
- Date: 2026-10-04

## Context

Sprint 7 (#142) tunes movement and frame data, and every tuning task needs to be measured.
#144 asks for a training mode: one player against a dummy, no stocks and no clock, a panel that
sets the dummy's percent and behaviour, freezes or resets the percent, pauses and advances one
frame at a time, and a readout of the combo counter, the move's frame data and frame advantage.

`GameSession` (ADR 0002) only takes input and wall-clock time, so a client cannot pause it or
change the match. Core must stay a pure `step` (ADR 0003), and the readout must not drift from the
rules it measures.

## Decision

Training is data in the match, and the session gets a second, optional port to steer it.

- **Core** carries `MatchState.training` (settings plus measurements), started by
  `MatchConfig.training`. `step` replaces the dummy's input with `dummyInput` (stand, crouch,
  jump, dodge, and from #154 a held DI while a hit freezes it: none, survival or combo), lets KO-ed fighters respawn without a match end, then `trackTraining` updates the
  combo counter (hits while the dummy stays in hitstun or hitlag) and follows the last hit until
  attacker and dummy can both act, which gives the frame advantage. A frozen dummy is held at its
  percent. Everything stays pure, deterministic and serializable.
- **Port** `TrainingControls` (`src/ports/training-controls.ts`): `setPaused`, `advanceFrame`,
  `configure(settings)` and `reset()`. Changes apply between frames through the pure
  `configureTraining` and `resetTraining`. `TrainingSession = GameSession & TrainingControls`.
- **Adapter** `LocalTrainingSession` extends `LocalGameSession`. While paused its clock keeps
  reading the time but runs no frames, so resuming does not catch up.
- **App** gets `createTrainingSession` beside `createSession`; the training panel is a
  `MenuPanel` and the readout a `GameView` (`TrainingHud`) that reads `MatchState.training`.

## Consequences

- The readout is computed by the same rules it describes and is unit-tested like them; a replay
  of a training session shows the same numbers.
- Versus matches carry no `training` field and play exactly as before.
- A remote session can offer training later by implementing the same port (or by refusing it:
  training is a local feature today).
- Pausing is a session concern, not a rule: core never knows about wall-clock pauses.

## Alternatives considered

- **Methods on `LocalGameSession` that `App` calls directly.** No ADR needed, but the app would
  depend on a concrete adapter, which rule 4 of AGENTS.md reserves for `main.ts`.
- **Training settings as extra input fields.** Keeps one port, but mixes menu state into
  per-frame input and into every input source.
- **Measurements in the view** (diffing states in the HUD). Less core code, but the numbers would
  depend on which frames the view happens to see, and they could not be tested with the rules.
