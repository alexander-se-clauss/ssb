# SSB

A browser-based 3D platform fighter in the style of Super Smash Bros., built with Three.js.
It is also a learning project for modern AI-assisted development.

## Quick start

```bash
npm ci
npm run dev      # open http://localhost:5173
```

| Player | Move  | Jump       | Drop / fast-fall | Attack | Special |
| ------ | ----- | ---------- | ---------------- | ------ | ------- |
| P1     | A / D | W or Space | S                | F      | G       |
| P2     | ← / → | ↑ or Num 0 | ↓                | .      | /       |

Menus: Enter or Space to start, arrow keys or W/S to move, Enter to pick. Esc or the Back
button goes back. On character select each player uses their own controls: move to pick a
fighter, attack (F / .) to pick, special (G / /) to cancel, then Enter when both are ready. Move
up onto the rules banner and pick it (or click it) to change the match rules. Options holds the
screen setting and the controls. After a match, the results screen offers a rematch or the main
menu.

## Development

```bash
npm run check    # typecheck, lint, format check, unit tests
npm run e2e      # browser smoke tests with Playwright
npm run build    # production build into dist/
```

## Where to read next

- [docs/product.md](docs/product.md): vision, rules and roadmap
- [docs/architecture.md](docs/architecture.md): layers, data flow and the server migration path
- [docs/ai-workflow.md](docs/ai-workflow.md): how this repo is set up for AI agents, and why
- [AGENTS.md](AGENTS.md): the instructions every coding agent reads
