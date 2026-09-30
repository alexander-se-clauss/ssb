# 0002 Ports and adapters around a pure core

- Status: Accepted
- Date: 2026-09-30

## Context

We start as a local browser game but want to move parts of the logic (the match simulation
first) to a server later without rewriting the client. Rendering with Three.js and input from
DOM events must not leak into the game rules.

## Decision

The game rules live in `src/core` as pure TypeScript with no browser dependencies. The client
talks to them only through interfaces in `src/ports` (`GameSession`, `InputSource`, `GameView`).
Concrete implementations live in `src/adapters` and are wired in `src/app/main.ts`.

## Consequences

- The core runs unchanged in the browser, in Node, in a worker, and in tests.
- A server-backed `RemoteGameSession` can replace `LocalGameSession` without touching views.
- New input devices and views are new adapters, not changes to existing code.
- Slightly more files and indirection than a single game loop file.
- Boundaries are enforced by ESLint and a DOM-free `tsconfig.core.json`.

## Alternatives considered

- Entity Component System framework (e.g. bitECS): powerful, but premature for two fighters and
  harder to keep serializable and pure. We can adopt ECS inside the core later if needed.
- A game engine (Babylon.js, PlayCanvas): more batteries, but it owns the loop and the state,
  which works against a server-authoritative future.
