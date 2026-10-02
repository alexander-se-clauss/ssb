# SSB

A browser-based 3D platform fighter in the style of Super Smash Bros., built with Three.js.
It is also a learning project for modern AI-assisted development.

## Quick start

```bash
npm ci
npm run dev      # open http://localhost:5173
```

| Device     | Move               | Jump              | Aim up   | Drop / fast-fall | Attack | Special | Dodge       | Start |
| ---------- | ------------------ | ----------------- | -------- | ---------------- | ------ | ------- | ----------- | ----- |
| Left keys  | A / D              | Space             | W        | S                | F      | G       | H           | Enter |
| Right keys | ← / →              | Num 0             | ↑        | ↓                | .      | /       | Right Shift | Enter |
| Gamepad    | Left stick / D-pad | X / Y or stick up | Stick up | Stick down       | A      | B       | L / R       | Start |

A direction held while pressing attack gives a tilt; pressing the direction and attack together
(or flicking the stick) gives a smash. Dodge on its own spot dodges; with left or right held it
rolls that way. In the air, dodge is an air dodge the way the stick points (once until you land or
are hit). There is no shield: dodging is the defence.

Menus: Enter or Space to start, arrow keys or W/S to move, Enter to pick; a gamepad moves with
the stick or d-pad, Start or A picks and B goes back. Esc or the Back button goes back. On character
select each device joins the first free slot (up to four players) by pressing attack; then its
cursor picks a fighter with attack, special un-picks, and special again leaves the slot. Start
with Enter or the gamepad's Start (or attack again) once two to four players joined and all picked. Move
up onto the rules banner and pick it (or click it) to change the match rules;
Done applies them; Esc or special discards them. Options holds the
screen setting, the Music and Effects volumes (Sound) and the controls. After a match, the results screen offers a rematch or the main
menu. F2 shows or hides the debug overlay: yellow hurtboxes (where a fighter can be hit), blue
hurtboxes while a fighter is invulnerable, and red hitboxes (attacks).

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
