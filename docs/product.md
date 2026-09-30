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

- Each player has a damage percent (starts at 0%).
- Hits add damage and launch the target. Launch speed grows with damage.
- Leaving the blast zone is a KO; respawn with brief invulnerability.
- Who wins depends on the match rules below (stock or time).

## Match rules

- **Stock:** each player has 1 to 9 lives; the last one with lives left wins.
- **Time:** 1 to 10 minutes with unlimited respawns. Score is KOs minus falls, as in Smash; a
  KO counts for whoever hit the fallen fighter last since it respawned, and a self-destruct is
  only a fall. The best score wins when time runs out; a tie is a draw (sudden death later).

## Combat concept (planned)

Smash meets Monster Hunter: defense is about commitment and timing, not a panic button.

- **No shield.** Everyone can spot dodge, roll and air dodge (Ultimate style: directional,
  actionable afterwards), each with invulnerability frames and recovery.
- **Block and counter are per character.** Block soaks a hit (less damage and knockback,
  pushback, can break). Counter is a timing window that strikes back automatically.
- **Cancel windows** in each move say what it can flow into (next combo step, dodge, block,
  counter). This gives each character a signature flow such as jab, jab, dodge-cancel, counter.
- **Everything is move data.** Frames, bone-attached hitboxes, damage, knockback, cancel windows,
  block and counter are fields, not per-character code. Specials can spawn objects
  (projectiles, traps) with their own hitbox, movement, lifetime and damage.
- Air jumps are per character (default one). Blast zones are large enough for off-stage combat.

## Non-goals (for now)

- Using Nintendo characters, names, music or assets. All content is original.
- Single-player story mode, pickup items, or more than four players.
- Mobile touch controls (later, maybe).

## Roadmap

Epics and tasks are GitHub issues: each epic is an issue labelled `epic` with its tasks as
sub-issues, and each task carries a `sprint-N` label. A sprint is a vertical slice that ends with
a playable build; it is done when that build works, not on a date.

- [x] **M0 Walking skeleton.** Two capsule fighters, one stage, run, jump, double jump,
      fast-fall, drop-through platforms, a jab, damage, knockback, stocks, KO and respawn,
      HUD, fixed-timestep loop, tests and CI.
- [ ] **S1 Menus.** Title screen, main menu, options (stock or time rules), Melee-style
      character select grid, stage select, results. Epic #1.
- [ ] **S2 Gamepad and body.** Gamepad adapter and menu navigation; fighters with head, torso,
      arms and legs, basic poses and per-part hurtboxes. Epics #3, #4.
- [ ] **S3 Move engine.** Move definition format (ADR), jab rebuilt as data, bone-attached
      hitboxes, knockback and hitlag, cancel windows and combos, hitbox debug overlay. Epic #5.
- [ ] **S4 Moves and dodges.** Tilts, standard smashes, aerials and landing lag; spot dodge,
      roll and air dodge. Epics #5, #6.
- [ ] **S5 Off-stage play.** Ledge grab and getups, larger blast zones in stage data, a camera
      that follows fighters off-stage, helpless state; character definitions, per-character air
      jumps, fighter 1. Epics #7, #8.
- [ ] **S6 Guard and specials.** Block and counter, spawned objects and projectiles, particle
      effects (fire, hit, KO), side and down specials, fighter 2. Epics #6, #7, #9.

Later, not yet planned: screen shake, dash and short hop, charged smashes, rebindable keys, up to
four players, a CPU opponent, glTF models, and online play (authoritative server
running `src/core` in Node, WebSocket transport behind `GameSession`, then rollback experiments).

## Open questions

Tracked in #10: dodge stamina, block direction, block and counter in the air, fighter names and
themes, art direction, and the online model (server-authoritative or peer-to-peer rollback).
