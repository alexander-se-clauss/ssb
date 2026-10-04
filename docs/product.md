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
- A match opens with READY: fighters stand still and ignore input until GO!, as in Melee. The
  match clock starts at GO. When it ends, the action freezes under a GAME! banner, then the
  results screen names the winner.

## Match rules

Set on character select, as in Melee: the banner at the top shows the rules and opens them.

- **Stock:** each player has 1 to 99 lives; the last one with lives left wins.
- **Time:** 1 to 60 minutes with unlimited respawns. Score is KOs minus falls, as in Smash; a
  KO counts for whoever hit the fallen fighter last since it respawned, and a self-destruct is
  only a fall. The best score wins when time runs out; a tie is a draw (sudden death later).

## Menu presentation

Menus use the Kombat look (epic #121), after Mortal Kombat 1 and Tekken: firelit black, gold
serif headings (Cinzel), spaced labels (Oswald) and a quiet list whose focused entry carries a
gold diamond and an ember glow. A button bar at the bottom of every menu but character select names what each button
does there (Enter / Esc on the keyboard, A / B on a gamepad, after the device used last). Every
screen supports up to four players. Behind the title and the menus stands a 3D set: a fighter
on a firelit stone platform in a spotlight, with fog, rising embers and ruined pillars. Stage selection and results keep compositions suited to
their content.
Results show a 3D medal podium for two to four players, with player-colored fighter models,
numbered steps and a gold laurel wreath for first place. Stock standings follow elimination order;
timed standings follow score, with ties sharing a place. Rematch and Main menu remain available.
Keyboard and controller users can reach rules and Back before or after joining a player slot.
Before joining, only these header actions can be selected; fighter cursors appear after joining.
Fighter selection is a firelit set: the roster as a row of diamonds at the top, the rules in the
top right, and four stone platforms with a nameplate under each. A joined player's platform lights
up in their gameplay colour with the fighter they hover on it, and the fighter strikes a pose once
the pick is confirmed; an open slot stays dark and its nameplate says Press Attack. Each nameplate
names the player, the fighter, the input device and the choosing/Ready state; a Ready to Fight
banner appears when all two to four joined players have confirmed.
In Options, directions navigate selections; confirming Screen toggles fullscreen. Sound sets
the Music and Effects volumes from 0 to 10; the game remembers them for the next visit.
Hover and keyboard/gamepad focus use outline, shadow and position cues, with brief feedback that
does not delay navigation. Every screen change plays one signature transition: a band of slanted
navy blades with a gold leading edge sweeps across and wipes the old screen away; the new screen
takes input at once. Layouts adapt to narrow and short viewports and respect reduced motion.

## Training mode

Training in the main menu (#144) is how we measure before we tune. One or more players pick on
character select as usual and fight a dummy on any stage, with no lives and no clock; a KO
respawns. Enter or Escape (Start on a pad) pauses into the training panel on the right: Resume,
Advance frame (one frame per press), the dummy's percent (in steps of 10) and whether it is
frozen there, what the dummy does (stand, crouch, jump, dodge; holding a direction for DI comes
with DI in S8), the dummy's fighter, Reset positions and Exit training. A readout in the bottom
left shows the combo (hits while the dummy stays in hitstun, and their damage; lit while it
runs), the last hit's frame advantage, and the first player's current or last move with its
frame, phase (startup, active, endlag), active frames and total.

## Combat concept (planned)

Smash meets Monster Hunter: defense is about commitment and timing, not a panic button.

- **No shield.** Everyone can sidestep, roll and air dodge (Ultimate style: directional,
  actionable afterwards), each with invulnerability frames and recovery.
- **Block and counter are per character.** Block soaks a hit (less damage and knockback,
  pushback, can break). Counter is a timing window that strikes back automatically. Both sit on
  the down special. A block guards the front only, so position matters, and only on the ground;
  a counter works in the air too (#10). Rivet blocks, Vela counters.
- **Cancel windows** in each move say what it can flow into (next combo step, dodge, block,
  counter). This gives each character a signature flow such as jab, jab, dodge-cancel, counter.
- **Everything is move data.** Frames, bone-attached hitboxes, damage, knockback, cancel windows,
  block and counter are fields, not per-character code. Specials can spawn objects
  (projectiles, traps) with their own hitbox, movement, lifetime and damage.
- Air jumps are per character (default one). Blast zones are large enough for off-stage combat.

## Fighters

- **Rivet** (fighter 1, #39), a stocky handyman and the all-rounder: medium weight and speed on
  a short-legged body. Neutral special _Haymaker_, a slow lunging punch that hits harder than
  his forward smash. Side special _Wrench Toss_ (#49), a wrench that spins out about four units
  and comes back to his hand, hitting once on the way out or back. Up special _Spring Jack_, a rising uppercut that carries a target up with
  four hits and launches it with a fifth, then leaves him helpless; it is his recovery. Down
  special _Iron Guard_ (#50), a block: he braces behind his forearms for as long as special is
  held. Hits from the front deal under a third of their damage and push him back instead of
  launching him; a smash-strength hit breaks the guard and stuns him for longer.
- **Vela** (fighter 2, #53), a bounty hunter in power armour with an arm cannon, and the
  contrast to Rivet: light, quick on the ground and in the air, floaty, with two air jumps. Hard
  to pin down, but the same hit launches her further. Neutral special _Pulse Shot_, a weak plasma
  bolt that flies across the stage, to poke and keep opponents out. Side special _Stasis Mine_
  (#49): she sets a mine in front of her feet, on the ground or hanging in the air to guard a ledge, that arms after half a second and pops the
  first opponent to step on it straight up, into a juggle; one mine at a time. Up special _Thruster_, a long
  boost up and forward on her boot jets that hits what it rams and leaves her helpless; it
  recovers from much further out than Spring Jack. Down special _Riposte_ (#51), a counter, on
  the ground and in the air: she waits in a low stance, and a hit that lands in its window deals
  her nothing and sets off _Riposte Blast_, a point-blank shot from the cannon, turned to where
  the hit came from. A whiffed Riposte leaves her open for a moment.

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
- [x] **S1 Menus.** A 3D arena title screen with posed fighters and keyboard/gamepad/mouse
      start, main menu, options (screen, controls), Melee-style
      character select with the match rules in its top bar, a centered stage grid with rendered
      scenery thumbnails and keyboard/gamepad/mouse selection, results, Back
      buttons. Epic #1.
- [x] **S2 Gamepad and body.** Gamepad adapter and menu navigation; fighters with head, torso,
      arms and legs, basic poses and per-part hurtboxes. Epics #3, #4.
- [x] **S3 Move engine.** Move definition format (ADR), jab rebuilt as data, bone-attached
      hitboxes, knockback and hitlag, cancel windows and combos, hitbox debug overlay. Epic #5.
- [x] **Sound** (beside S3). Menu sounds, attack, hit and KO sounds, music for the menus and
      each stage, music and effects volume in Options. Synthesized in the browser, original.
      Epic #83.
- [x] **Polish** (beside S4). Blade wipe between screens, READY / GO! at match start and a
      GAME! banner at match end, all in one style. Epic #108.
- [x] **Kombat UI** (beside S4). Menus in the Kombat look with a button bar; a 3D menu
      backdrop; a four-player character select on stone platforms; a four-player HUD across the
      top. Epic #121.
- [x] **S4 Moves and dodges.** Tilts, standard smashes, aerials and landing lag; spot dodge,
      roll and air dodge. Epics #5, #6.
- [x] **Fighter looks** (beside S4). Rivet, a handyman, and Vela, a bounty hunter in power armour
      with an arm cannon, built from primitives on the shared skeleton and playable with the
      capsule moveset until they get their own; their overalls and armour plates take the
      player's colour. Character definitions and own movesets stay in S5 and S6 (Rivet's body
      and specials since #39, Vela's stats and specials since #53).
- [x] **S5 Off-stage play.** Ledge grab (#40) and getups (#41), larger blast zones in stage
      data (#42), a camera that follows fighters off-stage (#43), helpless state (#44); character
      definitions (#37), per-character air jumps (#38), and fighter 1: Rivet (#39). Epics #7, #8.
- [ ] **S6 Guard and specials.** Block and counter, spawned objects and projectiles, particle
      effects (fire, hit, KO), side and down specials, fighter 2. Epics #6, #7, #9.
- [ ] **S7 Movement tuning.** A Melee-near tempo: training mode first (#144 done), faster air physics (#145 done),
      Melee dash with dash dance and pivot, a short hop button, auto-cancel windows and
      L-cancel, repeated dodges get weaker, dash and landing dust, movement benchmarks as
      tests. Epic #142.
- [ ] **S8 Combos and combat feel.** Melee knockback and hitstun, DI, SDI and crouch cancel,
      stale moves, tech and knockdown, grabs and throws, screen shake and launch trails, each
      fighter's combos pinned as tests. Epic #143.

Later, not yet planned: charged smashes, rebindable keys, a CPU
opponent, glTF models, and online play (authoritative server
running `src/core` in Node, WebSocket transport behind `GameSession`, then rollback experiments).

## Open questions

Tracked in #10: block direction, block and counter in the air, fighter names and
themes, art direction, and the online model (server-authoritative or peer-to-peer rollback).
