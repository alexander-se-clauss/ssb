# Product

> The "why" and "what". Agents read this to make product decisions the way we would.
> Keep it current: when scope changes, change this file in the same commit.

## Vision

A browser-based 3D platform fighter in the spirit of Super Smash Bros.: two to four players
knock each other off a floating stage. No install, instant play, readable and fun within
30 seconds. It starts as local couch multiplayer and grows into online play.

## Pillars

1. **Feel first.** Responsive controls and satisfying hits beat content volume. 60 fixed
   simulation ticks per second; input to reaction within one frame.
2. **Easy to learn, deep to master.** Percent-based knockback, a small move set per fighter,
   emergent depth from movement.
3. **Runs anywhere a browser does.** Desktop Chrome, Firefox and Safari; gamepad and keyboard.
4. **Online-ready by design.** Deterministic simulation behind interfaces, so the same rules run
   on a server or in rollback netcode.

## Core rules (current)

- Each player has a damage percent (starts at 0%) and a number of stocks (lives).
- Hits add damage and launch the target. Launch speed grows with damage.
- Leaving the blast zone costs a stock; respawn with brief invulnerability.
- Last player with stocks wins.

## Non-goals (for now)

- Using Nintendo characters, names, music or assets. All content is original.
- Single-player story mode, items, or more than four players.
- Mobile touch controls (later, maybe).

## Roadmap

Milestones are small vertical slices. Each ends with a playable build.

- [x] **M0 Walking skeleton.** Two capsule fighters, one stage, run, jump, double jump,
      fast-fall, drop-through platforms, a jab, damage, knockback, stocks, KO and respawn,
      HUD, fixed-timestep loop, tests and CI.
- [ ] **M1 Game feel.** Hitlag (freeze frames on hit), screen shake, dash and short hop, ledge
      grab, shield and dodge, landing lag, particles on hit and KO.
- [ ] **M2 A real move set.** Data-driven attacks (tilts, smashes, aerials, one special each),
      a move definition format, a hitbox debug overlay.
- [ ] **M3 Characters and content.** Two original fighters with distinct weight and speed,
      glTF models and animations, a second stage, menus (character and stage select).
- [ ] **M4 Input and players.** Gamepad support, rebindable keys, up to four players, a simple
      CPU opponent.
- [ ] **M5 Online.** Authoritative server running `src/core` in Node, WebSocket transport
      behind `GameSession`, then rollback netcode experiments.

## Open questions

- Art direction: low-poly stylised, toon-shaded, or something else?
- Names and themes for the first two original fighters.
- Online model for M5: server-authoritative with prediction, or peer-to-peer rollback?
