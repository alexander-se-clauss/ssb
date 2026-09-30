@AGENTS.md

## Claude Code specifics

- Skills in `.claude/skills/`: `feature` (implement end to end), `verify` (run all checks),
  `adr` (record a decision). Use them instead of improvising the process.
- Subagent `architecture-reviewer`: run it on your diff before proposing a commit.
- Hooks in `.claude/settings.json`: Prettier formats every edited file; the Stop hook runs
  `npm run check` and hands failures back to you; on the web, SessionStart runs `npm ci`.
- MCP servers in `.mcp.json`: `playwright` (drive and screenshot the running game) and
  `context7` (current docs for Three.js, Vite, Vitest; ask it before relying on memory for APIs).
- Personal, uncommitted preferences belong in `CLAUDE.local.md` or `.claude/settings.local.json`.
