---
name: adr
description: Write an Architecture Decision Record in docs/adr. Use when a decision is hard to reverse or shapes the codebase, such as adding a port, a dependency, a networking model or a new layer.
---

# Write an ADR

1. List `docs/adr/` and take the next free number (four digits, e.g. `0004`).
2. Copy `docs/adr/template.md` to `docs/adr/NNNN-kebab-case-title.md`.
3. Fill in Context (the forces and constraints), Decision (one clear sentence first, then details),
   Consequences (good and bad) and Alternatives considered. Keep it under one page.
4. Status starts as `Proposed`. Only the user changes it to `Accepted`.
5. If the ADR supersedes another, set the old one's status to `Superseded by NNNN`.
6. Add a line to the ADR list in `docs/architecture.md`.
