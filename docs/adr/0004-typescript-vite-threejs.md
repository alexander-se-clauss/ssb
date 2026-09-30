# 0004 TypeScript, Vite and Three.js

- Status: Accepted
- Date: 2026-09-30

## Context

We need a browser 3D stack that is fast to iterate on, well known to humans and AI models,
and shares code with a future Node server.

## Decision

TypeScript in strict mode, Vite for dev server and build, Three.js for rendering, Vitest for
unit tests, Playwright for browser tests, ESLint and Prettier for code quality.

## Consequences

- One language for client, server and tests.
- Three.js is a renderer, not an engine: we own the loop, which suits ADR 0002 and 0003.
- AI agents are very effective with this stack because it is extremely common; the
  `context7` MCP server supplies current API docs where training data is outdated.

## Alternatives considered

- Babylon.js: more built in, heavier, owns more of the architecture.
- React Three Fiber: great for UI-heavy 3D, but React reconciliation is unneeded in a game loop.
- Unity or Godot web export: large downloads, harder to share logic with a Node server.
