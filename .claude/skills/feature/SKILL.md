---
name: feature
description: Implement a gameplay or engine feature end to end (plan, test first, implement, verify, document). Use when asked to add or change game behaviour such as a new move, mechanic, stage, input device or UI element.
---

# Implement a feature

Follow these steps in order. Do not skip the plan or the verification.

1. **Understand.** Read the relevant section of `docs/product.md` and `docs/architecture.md`.
   Find the code involved (`src/core` for rules, `src/adapters` for I/O and rendering).
2. **Plan.** Write a short plan: which layer each change belongs to, which files change,
   which tests prove it. If the change needs a new port or crosses a layer boundary, stop and
   propose an ADR with the `adr` skill first. Share the plan before editing if it touches more than
   three files.
3. **Test first for game rules.** For anything in `src/core`, add or change a Vitest test that fails
   for the right reason. Use the helpers in `src/core/test-helpers.ts` (`settled`, `run`,
   `withFighter`, `inputOf`).
4. **Implement** the smallest change that makes the test pass. Tunable numbers go in
   `src/core/config.ts`, not inline.
5. **Verify** with the `verify` skill. For visible changes also run the game and look at it
   (Playwright MCP: open http://localhost:5173 and take a screenshot).
6. **Document.** Update `docs/product.md` (tick the roadmap item) and `docs/architecture.md` if the
   structure changed. Keep AGENTS.md accurate if a command or convention changed.
7. **Summarise** what changed, how it was verified, and anything left open.
