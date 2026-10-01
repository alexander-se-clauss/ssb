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
 src/adapters   Keyboard, Gamepad        LocalGameSession            ThreeView, DomHud
                (InputSource)            (GameSession)               (GameView)
                            │                      │                       │
 src/ports      InputSource ──────────── GameSession ─────────────── GameView     (interfaces)
                                                   │
 src/core                         step(state, inputs) => state                    (pure rules)
```

Dependencies point inward only: `app → adapters → ports → core`. The core knows nothing about
browsers, rendering or networking.

## Layers

| Layer    | Folder         | May import                         | Contains                                                                 |
| -------- | -------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Core     | `src/core`     | core only                          | Types, physics, combat, rules, stages, registry, skeleton, `step`, clock |
| Ports    | `src/ports`    | core                               | Interfaces between client and game                                       |
| Adapters | `src/adapters` | core (via index), ports, libraries | Keyboard, gamepad, local session, Three.js, HUD                          |
| App      | `src/app`      | everything                         | `main.ts` wiring, screens and menus, debug handle, CSS                   |

Fighter bodies are core data too (`skeleton.ts`): a 2D skeleton of bones with lengths and parents,
and poses as joint angles. `boneSegments` turns a pose into world joint positions, so hurtboxes
and hitboxes can follow bones and the view only draws what core computed.

**Enforced:** ESLint `no-restricted-imports` per folder (`eslint.config.js`) and a separate
`tsconfig.core.json` without DOM types, so `document` or `window` in core fails typecheck.

## One frame

1. `main.ts` hands `App` a list of input devices: the two keyboard halves and four gamepads
   (`GamepadInputSource` polls the Gamepad API, since gamepad buttons have no events). While a
   match runs, `App` samples each player's device and calls `session.setInput(slot, input)`. On
   character select it samples every device, and on every frame it polls the gamepads for menu
   commands; see Screens. Adapters deliver stick values with the deadzone already removed
   (`applyDeadzone`); telling a tilt from a smash is a game rule, so it lives in core
   (`attack-input.ts`: a plain-data `StickTracker` per fighter, which the move engine will read).
2. `session.update(now)` asks `FixedStepClock` how many 1/60 s ticks are due and runs
   `step()` that many times. Rendering speed never changes game speed.
3. Each `GameView` renders `session.view()`: previous state, current state and `alpha`, so
   visuals interpolate smoothly on 120/144 Hz screens.
4. Events from `step()` (`hit`, `ko`, `match-end`) go to `session.onEvent` listeners
   (future: sound, particles, rumble).

## Screens

`src/app/screens.ts` lists the screens (title, main menu, options, controls, character select,
stage select, match, results) and the allowed moves between them, as plain data with a unit test.
`App` shows menu screens as HTML over the canvas. As in Melee, character select is where a match is
set up: its top bar holds Back and the rules banner, which opens the rules overlay (a second
`MenuPanel`, editing a draft that applies on Done). Options holds game settings only. On character
select a device joins the first of four free player slots by pressing attack, then moves that
player's cursor; special un-picks, then leaves the slot (later players move up, so slots have no
gaps), and from a device that has not joined goes back. Start, or attack once everyone joined
has picked, starts (two to four players); `PlayerInput.start` is the pad's Start button, and the
simulation ignores it. The match gets the joined players in slot order, each with their own
device. The controls screen and the in-match hint name devices (left keys, right keys, gamepad),
not players. Press detection lives in `character-select.ts`. The other menus (`MenuPanel`, stage
select and the rules overlay included) read the keyboard as DOM keys and the gamepads as polled
devices: `menu-commands.ts` turns presses into commands for `MenuPanel.command()`, which moves the
focus to the nearest button in that direction (`spatial-focus.ts`), so the Back button is reachable
too. Menus with a way back show a Back button in their top left corner, except results and the
rules overlay, whose own buttons (Main menu, Done) do that job. Every screen listens on `window`,
so each handler checks and marks the event in `key-events.ts`: one key press changes the screen at
most once. Entering `match` creates a `GameSession` and its views; leaving it disposes them, so
every match starts clean.

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

| Level | Tool       | What                                                                                          | Where               |
| ----- | ---------- | --------------------------------------------------------------------------------------------- | ------------------- |
| Unit  | Vitest     | Game rules as scenarios (`settled`, `run`, `withFighter`)                                     | `src/**/*.test.ts`  |
| Unit  | Vitest     | Adapters with fakes (e.g. keyboard with an `EventTarget`)                                     | next to the adapter |
| E2E   | Playwright | Full flow from title to results and back (match ended via `__SSB__.hold`), keys move fighters | `e2e/`              |

## Decisions

- [0001 Record architecture decisions](adr/0001-record-architecture-decisions.md)
- [0002 Ports and adapters around a pure core](adr/0002-ports-and-adapters.md)
- [0003 Deterministic fixed-timestep simulation](adr/0003-deterministic-fixed-timestep.md)
- [0004 TypeScript, Vite and Three.js](adr/0004-typescript-vite-threejs.md)
