---
name: verify
description: Run the project's full verification (typecheck, lint, format, unit tests, e2e smoke) and fix what fails. Use before declaring any code change done, before committing, and when asked to check the build.
---

# Verify a change

1. Run `npm run check` (typecheck, lint, format check, unit tests).
2. If you changed anything under `src/adapters` or `src/app`, or anything visual, also run
   `npm run e2e`. If Playwright cannot find a browser, set `PLAYWRIGHT_CHROMIUM_PATH` to an
   installed Chromium instead of downloading one.
3. On failure: read the first error, fix the root cause, rerun. Never weaken a test, add
   `eslint-disable`, or use `any` / `@ts-ignore` to get green. If a lint rule about layer boundaries
   fires, the code is in the wrong layer: move it (see `docs/architecture.md`).
4. Report the commands you ran and their result in one or two lines.
