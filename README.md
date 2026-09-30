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

Press R to restart when a match is over.

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
