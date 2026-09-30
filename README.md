# SSB

A browser-based 3D platform fighter in the style of Super Smash Bros., built with Three.js.
It is also a learning project for modern AI-assisted development.

## Quick start

```bash
npm ci
npm run dev      # open http://localhost:5173
```

| Player | Move  | Jump       | Drop / fast-fall | Attack |
| ------ | ----- | ---------- | ---------------- | ------ |
| P1     | A / D | W or Space | S                | F      |
| P2     | ← / → | ↑          | ↓                | .      |

Menus: Enter or Space to start, arrow keys or W/S to move, Enter to pick. Esc on the main menu returns to the title screen. After a match, the results screen offers a
rematch or the main menu.

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
