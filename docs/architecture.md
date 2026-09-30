# Architecture

> The "how". Describes the structure and the rules that keep it healthy. The rules marked
> **enforced** are checked by tooling; the rest are checked in review.

## Overview

Ports and adapters (hexagonal architecture) around a deterministic simulation.

```
            ┌────────────────────────── src/app (composition root) ─────────────────────────┐
            │  wires adapters together, runs requestAnimationFrame, installs debug handle   │
            └───────────────┬──────────────────────┬───────────────────────┬────────────────┘
                            │                      │                       │
 src/adapters   KeyboardInputSource      LocalGameSession            ThreeView, DomHud
                (InputSource)            (GameSession)               (GameView)
                            │                      │                       │
 src/ports      InputSource ──────────── GameSession ─────────────── GameView     (interfaces)
                                                   │
 src/core                         step(state, inputs) => state                    (pure rules)
```

Dependencies point inward only: `app → adapters → ports → core`. The core knows nothing about
browsers, rendering or networking.

## Layers

| Layer    | Folder         | May import                         | Contains                                                |
| -------- | -------------- | ---------------------------------- | ------------------------------------------------------- |
| Core     | `src/core`     | core only                          | Types, physics, combat, stages, registry, `step`, clock |
| Ports    | `src/ports`    | core                               | Interfaces between client and game                      |
| Adapters | `src/adapters` | core (via index), ports, libraries | Keyboard, local session, Three.js, HUD                  |
| App      | `src/app`      | everything                         | `main.ts` wiring, debug handle, CSS                     |

**Enforced:** ESLint `no-restricted-imports` per folder (`eslint.config.js`) and a separate
`tsconfig.core.json` without DOM types, so `document` or `window` in core fails typecheck.

## One frame

1. `main.ts` samples every `InputSource` and calls `session.setInput(slot, input)`.
2. `session.update(now)` asks `FixedStepClock` how many 1/60 s ticks are due and runs
   `step()` that many times. Rendering speed never changes game speed.
3. Each `GameView` renders `session.view()`: previous state, current state and `alpha`, so
   visuals interpolate smoothly on 120/144 Hz screens.
4. Events from `step()` (`hit`, `ko`, `match-end`) go to `session.onEvent` listeners
   (future: sound, particles, rumble).

## Determinism rules

- `step()` is pure: same state and inputs, same result. A test replays 1200 scripted frames
  twice and compares the JSON.
- No wall-clock time, no unseeded randomness, no iteration over unordered keys in core.
- State is plain data (`MatchState`), cloneable with `structuredClone` and sendable as JSON.
- Floating point is deterministic on one machine and engine. Cross-platform determinism
  (needed for peer-to-peer rollback) may later require fixed-point math; see ADR 0003.

## Moving logic to a server

The seam is `GameSession`. The plan for online play (see "Later" in the product roadmap):

1. Run `src/core` in Node on a server (it has no browser dependencies, enforced).
2. Add `RemoteGameSession implements GameSession` in `src/adapters/remote-session`. `setInput`
   sends inputs over a WebSocket; `update` applies received snapshots and predicts locally with
   the same `step()`.
3. Change one line in `src/app/main.ts` to pick the remote session. Views and inputs stay as
   they are.

Other logic follows the same pattern: define a port first, implement locally, swap later.

## Testing strategy

| Level | Tool       | What                                                      | Where               |
| ----- | ---------- | --------------------------------------------------------- | ------------------- |
| Unit  | Vitest     | Game rules as scenarios (`settled`, `run`, `withFighter`) | `src/**/*.test.ts`  |
| Unit  | Vitest     | Adapters with fakes (e.g. keyboard with an `EventTarget`) | next to the adapter |
| E2E   | Playwright | Game boots, renders, reacts to keys via `window.__SSB__`  | `e2e/`              |

## Decisions

- [0001 Record architecture decisions](adr/0001-record-architecture-decisions.md)
- [0002 Ports and adapters around a pure core](adr/0002-ports-and-adapters.md)
- [0003 Deterministic fixed-timestep simulation](adr/0003-deterministic-fixed-timestep.md)
- [0004 TypeScript, Vite and Three.js](adr/0004-typescript-vite-threejs.md)
