# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, ...) working in this
repository. Humans are welcome too. Keep this file short and true: every line costs context.

## Project

A browser-based 3D platform fighter in the style of Super Smash Bros., built with TypeScript,
Vite and Three.js. Local multiplayer first; the architecture is prepared to move the simulation
to a server later. Product intent: `docs/product.md`. Structure and rules: `docs/architecture.md`.

## Commands

| Task                                     | Command                                  |
| ---------------------------------------- | ---------------------------------------- |
| Install                                  | `npm ci`                                 |
| Run the game (http://localhost:5173)     | `npm run dev`                            |
| All fast checks (run before saying done) | `npm run check`                          |
| Unit tests only / one file               | `npx vitest run src/core/combat.test.ts` |
| Browser smoke tests                      | `npm run e2e`                            |
| Production build                         | `npm run build`                          |

## Architecture in five rules

1. `src/core` is the game: pure, deterministic TypeScript. No Three.js, no DOM, no `Date.now()`,
   no `Math.random()`. `step(state, inputs) => nextState` must stay a pure function.
2. `src/ports` holds interfaces only (`GameSession`, `TrainingControls`, `InputSource`, `GameView`,
   `AudioOutput`).
3. `src/adapters` implements ports (local session, keyboard, Three.js view, HUD). Import the
   core only through `src/core/index.ts`.
4. `src/app` is the composition root. It is the only place that picks concrete adapters.
5. Game state (`MatchState`) is plain serializable data. No classes or functions inside it.

These rules are enforced by ESLint (`no-restricted-imports`) and by `tsconfig.core.json`
(no DOM types in core). If a rule fires, move the code; do not disable the rule.

## Conventions

- TypeScript strict mode, including `noUncheckedIndexedAccess`. No `any`, no `@ts-ignore`.
- Tuning numbers live in `src/core/config.ts`. Units: stage units and frames (60 per second).
- Tests sit next to the code as `*.test.ts`. Use `src/core/test-helpers.ts` for scenarios.
- New game rules come with a test that describes the behaviour, written first.
- Formatting is Prettier's job (a hook runs it on every edit). Do not hand-format.
- Commit messages: imperative mood, e.g. `Add air dodge to fighters`.

## Definition of done

- `npm run check` passes (the Stop hook runs it for Claude Code).
- Visible changes were looked at in the browser (Playwright MCP screenshot or `npm run e2e`).
- `docs/product.md` roadmap and `docs/architecture.md` still describe reality.
- Decisions that are hard to reverse have an ADR in `docs/adr/`.

## Boundaries

- Ask before: adding a runtime dependency, changing a port interface, changing CI, pushing.
- Never: commit secrets or `.env` files, force-push, skip or weaken tests to get green.

## Debugging the running game

`window.__SSB__.screen()` returns the current screen and `window.__SSB__.state()` the current
`MatchState` (undefined outside a match). `hold(player, input)` and `release(player)` take over
a player's controls, e.g. to end a match. `sounds()` lists the cues, music tracks and volumes
played so far. Use it from the Playwright MCP or e2e tests instead of reading pixels.
