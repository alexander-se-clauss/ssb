# Working with AI agents on this project

A guide to how this repository is set up for AI-assisted development, and why. Read it once,
then come back when something feels slow or unreliable.

## The big idea: context plus a harness

An agent is only as good as (1) the context it gets and (2) the feedback it gets.

- **Context** is what the agent knows when it starts: instruction files, docs, the code it reads.
  Too little and it guesses; too much and the important parts drown. Keep files short and true.
- **The harness** is everything that tells the agent, automatically, whether its work is right:
  types, lint rules, tests, hooks, CI. An agent with a fast, strict harness can work for a long
  time without you. An agent without one produces plausible code you have to check by hand.

Most of the files in this repo exist to serve one of those two.

## Map of the AI-related files

| File                                     | Purpose                                                        | Read by                 |
| ---------------------------------------- | -------------------------------------------------------------- | ----------------------- |
| `AGENTS.md`                              | Commands, rules, definition of done. The cross-tool standard.  | Every agent, every time |
| `CLAUDE.md`                              | Imports AGENTS.md, adds Claude Code specifics                  | Claude Code             |
| `docs/product.md`                        | Why and what: vision, rules, roadmap, non-goals                | On demand               |
| `docs/architecture.md`                   | How: layers, data flow, rules, testing                         | On demand               |
| `docs/adr/`                              | Why a hard-to-reverse decision was made                        | On demand               |
| `.claude/settings.json`                  | Permissions and hooks, shared with the team                    | Claude Code             |
| `.claude/hooks/`                         | Scripts the harness runs automatically (format, verify, setup) | Claude Code             |
| `.claude/skills/`                        | Reusable procedures (`feature`, `verify`, `adr`)               | Claude Code, on demand  |
| `.claude/agents/`                        | Specialised subagents (`architecture-reviewer`)                | Claude Code, on demand  |
| `.mcp.json`                              | MCP servers: tools the agent can use (browser, docs)           | Claude Code             |
| `eslint.config.js`, `tsconfig.core.json` | Architecture rules as machine checks                           | Everyone, automatically |

**Why AGENTS.md and CLAUDE.md?** `AGENTS.md` is the vendor-neutral convention read by most
coding agents. Claude Code reads `CLAUDE.md`, which imports `AGENTS.md` with `@AGENTS.md`, so
there is a single source of truth.

**Why are product and architecture separate from AGENTS.md?** AGENTS.md is loaded into every
session, so it must be small. The longer docs are loaded only when a task needs them
("progressive disclosure"). Skills work the same way: only their one-line description is always
in context.

## The loop for every change

1. **Explore.** Ask the agent to read the relevant docs and code and explain its understanding.
   Correcting a wrong understanding here is cheap.
2. **Plan.** For anything non-trivial, ask for a plan first (Claude Code: plan mode, Shift+Tab).
   Review which layers and files it touches.
3. **Implement test first.** Game rules are pure functions, so behaviour tests are easy to write
   first. A failing test is a precise specification for the agent.
4. **Verify.** The Stop hook runs `npm run check` and refuses to let the agent finish on red.
   For visible changes, the agent opens the game with the Playwright MCP and looks.
5. **Review.** Run the `architecture-reviewer` subagent, then read the diff yourself. You own
   what gets merged.
6. **Commit small.** One feature or fix per commit or PR. Small diffs are easy to review and easy
   to revert.

The `feature` skill encodes exactly this loop, so you can say "use the feature skill to add
shielding" and get the process for free.

## The harness in this repo

| Check                | Catches                              | Runs                           |
| -------------------- | ------------------------------------ | ------------------------------ |
| TypeScript strict    | Wrong types, missing null checks     | `npm run check`, editor, CI    |
| `tsconfig.core.json` | DOM usage in core                    | `npm run check`, CI            |
| ESLint layer rules   | Imports that cross a layer boundary  | `npm run check`, CI            |
| Prettier             | Style noise                          | PostToolUse hook, CI           |
| Vitest               | Broken game rules, non-determinism   | `npm run check`, Stop hook, CI |
| Playwright           | Game fails to boot or react to input | `npm run e2e`, CI              |
| Stop hook            | Agent finishing with a red build     | End of each Claude turn        |

When the agent makes the same mistake twice, do not just correct it in chat. Turn the lesson into
something durable, in this order of preference:

1. A **check** (lint rule, type, test) if the mistake is mechanical.
2. A line in **AGENTS.md** if it is a convention that applies everywhere.
3. A **skill** if it is a multi-step procedure.
4. An **ADR** if it is a design decision.

## MCP servers

MCP (Model Context Protocol) servers give the agent extra tools.

- **playwright**: lets the agent open the game in a real browser, press keys, take screenshots and
  read `window.__SSB__.state()`. This closes the loop on visual work.
- **context7**: fetches current documentation for libraries (Three.js changes quickly, and model
  training data lags behind).
- **GitHub**: the `gh` command line tool usually covers issues and PRs without an MCP server.
  Add the GitHub MCP later if you want richer integration.

Add MCP servers sparingly: each one adds tool descriptions to every session's context.

## Prompting tips that pay off

- Point at files: "In `src/core/fighter.ts`, add ..." beats "add ...".
- State the acceptance test: "Done when a test shows a fighter cannot jump while shielding."
- Ask for the plan before the code when you are unsure what you want.
- Start a fresh session for a new task. Long sessions accumulate stale context.
- Run independent tasks in parallel sessions or git worktrees, not in one long conversation.
- If the agent is going in circles, stop, `/clear`, and restate the task with what you learned.
