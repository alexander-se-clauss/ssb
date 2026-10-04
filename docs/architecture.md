# Architecture

> The "how". Describes the structure and the rules that keep it healthy. The rules marked
> **enforced** are checked by tooling; the rest are checked in review.

## Overview

Ports and adapters (hexagonal architecture) around a deterministic simulation.

```
            ┌────────────────────────── src/app (composition root) ─────────────────────────┐
            │  wires adapters together, runs requestAnimationFrame, installs debug handle   │
            └───────────────┬──────────────────────┬───────────────────────┬────────────────┘
                            │                      │                       │
 src/adapters   Keyboard, Gamepad        LocalGameSession            ThreeView, DomHud
                (InputSource)            (GameSession)               (GameView)
                            │                      │                       │
 src/ports      InputSource ──────────── GameSession ─────────────── GameView     (interfaces)
                                                   │
 src/core                         step(state, inputs) => state                    (pure rules)
```

Dependencies point inward only: `app → adapters → ports → core`. The core knows nothing about
browsers, rendering or networking.

## Layers

| Layer    | Folder         | May import                         | Contains                                                                        |
| -------- | -------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| Core     | `src/core`     | core only                          | Types, physics, combat, moves, rules, stages, registry, skeleton, `step`, clock |
| Ports    | `src/ports`    | core                               | Interfaces between client and game, training controls, and audio                |
| Adapters | `src/adapters` | core (via index), ports, libraries | Keyboard, gamepad, local session, Three.js, HUD, Web Audio                      |
| App      | `src/app`      | everything                         | `main.ts` wiring, screens and menus, debug handle, CSS                          |

A character is plain data too (`CharacterDef` in `types.ts`, registered in `registry.ts`): its
`stats` (`CharacterStats`: body box, walk, dash and run speeds, dash and skid frames, air speed, gravity, fall speeds, jump and short hop speeds,
`airJumps`, weight, landing lag), its `skeleton` and its `moves`. The capsule's stats are `FIGHTER` in
`config.ts`, and other characters' stats sit beside them (`RIVET_STATS`, `VELA_STATS`); rules every fighter
shares are `FIGHTER_RULES`. Rivet (#39) has his own `STOCKY` skeleton in `skeleton.ts` and his
specials in `move-data/rivet.ts`; Vela (#53) plays on `HUMANOID` with her specials in
`move-data/vela.ts`. `FighterState.jumpsRemaining`
counts the ground jump plus `airJumps` on the ground, and only the air jumps once airborne;
landing gives them all back. The short hop button (`PlayerInput.shortHop`, #147) jumps like
`jump`, but a ground jump from it leaves at the character's `shortHopVelocity` (about 30 frames in
the air, `short-hop.test.ts`); the buffered press carries `shortHop`, and `FighterState.shortHop`
remembers it through the jump squat. In the air it is the air jump, from a ledge the ledge jump; tap-jump stays a full jump. Core code reads a fighter's
definition with `characterOf` (`character.ts`), so movement, knockback (divided by the target's
`weight`), hurtboxes and bone hitboxes follow the character it plays. Looks stay in the view.
Fighter bodies are core data too (`skeleton.ts`): a 2D skeleton of bones with lengths and parents,
and poses as joint angles. `boneSegments` turns a pose into world joint positions;
`plantedBoneSegments` then lowers the body until its feet rest on the fighter's position, so a
bent-knee stance stands on the ground. That planted body is the one to use: each bone has a
`radius` and a `shape` (capsule along the bone, or a ball in its middle for the head), `hurtboxes`
in `combat.ts` turns them into one hurtbox per body part, and hits test against those, so a crouch
or a lean dodges what it looks like it dodges. The view only draws what core computed: `ThreeView`
places each character's parts on the bones (`body-layout.ts`), kept within the bone radii so the
look matches the hurtboxes.
Terms, as in Melee: a **hurtbox** is where a fighter can be hit (one per body part), a **hitbox**
is where an attack hits (`activeHitboxes`). F2 shows both in the running game: yellow hurtboxes,
blue while invulnerable, red hitboxes (`debug-colors.ts`).
Attacks are moves (ADR 0006): plain-data `MoveDef`s in `move-data/`, played by one move runner
in `fighter.ts`. A fighter in the `attack` action stores only the move's id and its frame
(`actionFrame`), and `activeHitboxes` reads the definition to find which hitboxes are on. A
hitbox sits on a bone of the planted body (the jab on the fist) or relative to the feet. It hits
each target once per `group`; when several touch one target, the highest `priority` wins
(`strikingHitbox`), and `hitTargets` records who each group already hit. Each hitbox sets its
own damage, angle and knockback. A hit freezes attacker and target for `hitlagFrames`, longer for
harder hits (`HITLAG` in `config.ts`): nothing moves, and the launch is held until it ends.
In the air, horizontal speed above the character's `airSpeed` bleeds off at `FIGHTER_RULES.launchDecay`, so a
sideways launch flies a set distance instead of drifting on almost undamped.
Move data is one file per family in `move-data/` (`jab.ts`, `tilts.ts`, `smashes.ts`,
`aerials.ts`, `ledge.ts`, and a file of specials per character, `rivet.ts` and `vela.ts`, each registered in `move-data/index.ts`). A move with a `landingLag` is an aerial:
landing while it runs ends it and puts the fighter in the `landing` action for that many frames
(`landingLagFrames`). An aerial's `autoCancel` windows (#148, `auto-cancel.test.ts`) mark its
first and last frames, clear of the hitboxes: landing in them costs only the normal landing lag,
as in Melee. Between them an L-cancel (#149, `l-cancel.test.ts`) halves the aerial's landing lag,
never below the normal one: a dodge press during an aerial starts `FighterState.lCancelPress`, and
landing within `L_CANCEL.windowFrames` of it counts; a new press only counts once
`L_CANCEL.lockoutFrames` have passed since the last one that did, so mashing misses.
`FighterState.lastLanding` records how the last aerial landed. Landing from a jump or fall without an aerial costs the character's `landingLagFrames`;
a fighter in hitstun lands without lag. An aerial press still in the buffer on landing is
dropped, and during an aerial the fighter drifts and fast-falls like `airborne`. As in Melee,
holding down while falling drops at once (for as long as it is held) at the character's `fastFallSpeed` (#145), instead of
speeding up to it; `air-physics.test.ts` pins each fighter's full hop and fast fall. On the
ground the fighter moves as in Melee (#146, `ground-movement.ts`): a slowly pushed stick walks
(`walk`), a sideways flick dashes (`dash`) for `initialDashFrames`, a flick back during the dash
dashes the other way (dash dance) or, on its first frame, turns in place (pivot), and held past it
the fighter runs (`run`). Letting go of a run skids (`skid`), pushing back brakes and turns round
(`runTurn`), both over `skidFrames`. Jumps, moves and dodges start out of all of them. Keys
only send a full stick, so on a keyboard every press from standing dashes; walking needs an analog
stick (or a key held after a pivot). A
press of attack or special picks a move slot from the situation and the stick (`move-slots.ts`:
jab, tilts and smashes on the ground, five aerials, four specials), and the character's `moves`
table fills each slot with a move id or leaves it empty. The press goes into
`FighterState.buffer` as that slot, with the way the move will face, and waits there up to
`INPUT.bufferFrames` until the fighter can act (presses during hitlag are buffered too, and do not
age). A move's `cancels` list windows in which a buffered slot starts the next move: the jab
chains into jab 2 and jab 3. A window can also name `dodge` (#52), which starts whichever dodge
the press asked for and can start there, or `downSpecial`, the character's block or counter;
the jab chain has both, so Vela's flow jab, jab, sidestep, Riposte and Rivet's jab, jab, Iron
Guard come from shared move data and each character's down special.
A ground jump starts with a short `jumpsquat` (the character's `jumpSquatFrames`) as in Melee: an attack
pressed during it is still a ground attack, so flicking the stick up (which tap-jumps) and
pressing attack plays the up smash. A jump press waits in the buffer like the others, so a double
jump pressed late in an aerial or air dodge comes out as soon as it ends. A jump never pushes a waiting move or dodge out of the buffer, and it is not
buffered in hitstun or with no jump left; landing drops it.
There is no shield: the dodge button (`PlayerInput.shield`) buffers a sidestep out of the stage
plane (`sidestepIn` into the background with the stick centred, or up on the keyboard, where up is
not a jump, `sidestepOut` towards the
camera with it down), or a `roll` along the plane when the stick is pushed sideways
(`DODGE.rollStick`), and the fighter plays it with frame data from `DODGE` in `config.ts`: a roll towards the facing is a `forwardRoll`, which turns around at
the end as in Melee, and one away from it a `backRoll`, which slides back keeping the facing.
The facing counts from before a turn the stick made in the last `DODGE.turnGraceFrames`
(`FighterState.turnedFrom`), so a direction key pressed just before the dodge key still slides
back. The view adds the Melee look (`three-renderer/dodge-motion.ts`): a sidestep steps out of
the stage plane and back, a roll somersaults along it, an air dodge spins round once; the game
itself stays 2D. On the dodge's invulnerable frames
`invulnerableFrames` is kept above zero, so combat skips the fighter and the view shows it as it
does after a respawn; the frames after them are recovery and can be punished. A roll moves at an
even speed and stops at its platform's edge. In the air the button starts an
Ultimate-style `airDodge` (`DODGE.air`): it carries the fighter the way the stick points (or holds
it in place) with gravity paused, then the fighter falls and can act again. It is used once per
airtime (`FighterState.airDodgeUsed`), and landing or being hit gives it back; landing during it
costs `DODGE.air.landingLag`, and a buffered air dodge is dropped on landing. During an aerial
the button L-cancels instead (#149): the press is not buffered and never becomes an air dodge.
A move flagged `helpless` in its data (a recovery move, #44) that ends in the air puts the
fighter in the `helpless` action, Melee's special fall: it only drifts (`HELPLESS.drift`), cannot
fast-fall, jump, attack or dodge, and it ends on landing (with `HELPLESS.landingLagFrames`), on a
ledge grab or on a hit.
A move can also set the fighter's speed on given frames (`motion` in its data, #39): `x` the way
it faces and `y` upward, a part left out keeping its speed. That is how a punch lunges and a
recovery move rises; an upward speed takes a grounded fighter into the air. A recovery move
does not fast-fall, and on its way down it already catches a ledge.
A move can spawn objects (`spawns` in its data, #45), such as a projectile. On the spawn's frame
`step` adds a `SpawnedObject` to `MatchState.objects`: plain data with its owner, position,
velocity, `launchVelocity`, age, lifetime, radius, `behavior`, the `moveId` that spawned it and its own hit (`HitDef`, the damage and launch part of a
hitbox), numbered from `MatchState.nextObjectId` so a view can follow it. Each frame
`objects.ts` moves it by its velocity, and it hits the first fighter its circle touches that is
not its owner and not invulnerable (`applyHit` in `combat.ts`, shared with hitboxes): the target
is launched the way the object flies (its owner's facing when it does not fly sideways), only the target freezes, the owner gets the credit, and the
object is gone. It is also gone when its lifetime ends or it leaves the blast zone; it outlives
its owner's move and stock. A move's `spawnLimit` (#49) caps how many of its objects one fighter
has out: a new one pushes out that fighter's oldest (`limitObjects`). Spawns come from the frame's snapshot like hitboxes, so a fighter
hit as it fires still fires; object hits are worked out after hitbox hits, so a fighter struck by
both on one frame takes both damages and flies with the object's launch.
How an object moves is data too (`behavior` on the spawn, #46): `straight` flies on, `arc` is
pulled down by its own gravity and is gone once it lands on a platform, `trap` stays where it
was set and only hits from `armFrames` on, and `return` slows evenly to a stop at `turnFrames`,
then flies back at its start speed towards where its owner is now and is gone when it reaches
them (or when they are out of the match). Platforms stop only an arc, and only from above. A hit
launches the way the object flies, so a boomerang hits on its way back towards its owner.
Effects are cosmetic and stay out of the game (#47). Core knows them only by id: a move lists
`effects` (an id such as `fire`, an anchor like a hitbox's, and a frame window), a spawn may name
the `effect` its object trails, and `activeEffects` in `combat.ts` says which are on this frame
and where, the way `activeHitboxes` does. A move's effects are derived from the move and its
frame, not stored; a spawned object carries its `effect` id in `MatchState` for views only. The
view turns the ids into particles: `particles.ts` holds a look (`EffectPreset`) per id and a
fixed-size `ParticlePool` per look, stepped by elapsed game frames so a pause freezes them, and
seeded so the same frame pacing gives the same flames; `effect-layer.ts` draws each pool as one
cloud of points. Hit sparks and KO bursts (#48) come from session events, not from the state:
`hit-effects.ts` turns a `hit` event into sparks at its `position`, more and faster the harder it
`launch`ed, and a `ko` event into a burst where the fighter left the blast zone. The camera
lingers on a KO burst for a moment, since the fighter respawns at once.
`object-layer.ts` draws spawned objects as balls in their owner's colour, a trap faint until it
is armed.
A block is a move with a `guard` (#50), not a new kind of move: on its guard frames, on the
ground, `activeGuard` in `combat.ts` returns it, and `applyHit` lets it take a hit that comes from
in front (the attacker's feet or the object, against the blocker's facing). A taken hit deals
`damageScale` of its damage and pushes the blocker back along the ground instead of launching it;
the blocker stays in its move. A hit of `breakDamage` or more breaks the guard and lands in full,
with `breakStun` more hitstun. The guard's `hold` frame keeps the move waiting while special is
held. A move with a guard cannot start in the air and ends when the blocker leaves the ground.
The `hit` event says `guard: 'blocked'` or `'broken'`, and the view throws off blue shards.
A counter is a move with a `counter` (#51): on its window frames `activeCounter` returns it, and
`applyHit` turns a hit from any side, a fighter's or an object's, into no damage: the fighter
faces where it came from (the attacker's feet or the object) and starts the counter's `into`
move, unhittable until that move's hitboxes are done. Both freeze in hitlag as for a hit. A
whiffed counter just plays out its recovery frames. The `hit` event says `guard: 'countered'`
with no damage, and the view flashes gold.
Ledges are stage data (`StageDef.ledges`, #40): a fighter falling near a free one snaps to hang
from it (`ledge.ts` works out where from the character's own hanging pose), with brief
invulnerability and its air jumps and air dodge back, and lets go after `LEDGE.hangFrames`
(#41: from `LEDGE.waitFrames` on, a fresh press or stick push picks jump, roll, attack, stand or
let go; held input does not count. Climbing follows a fixed path, `climbPosition` in `ledge.ts`,
not physics: the fighter stays `grounded: false` until it is on the stage, and the ledge is free
for others from the first climbing frame. The attack is the character's `ledgeAttack` move slot,
which no button press resolves to (`PRESS_SLOTS` vs `MOVE_SLOTS`)). One
fighter per ledge: `step` updates the fighters on a ledge first, so a ledge let go of or climbed
from is free on that same frame, then the others in slot order, each handed the ledges held by
the rest, so of two reaching a ledge on the same frame the lower slot gets it.
Each fighter carries its current `pose` in `FighterState`: `step` eases it a little each frame towards
the pose of its movement state, with idle breathing and a walking and running stride (`poses.ts`), and the
view interpolates it between frames like the position. A move has pose keyframes instead: the
body closes in on the first one and from then on follows them exactly (`movePose`), so a bone
hitbox reaches the same spot every time. Key poses are data in `pose-data.ts`.
A stage's look lives in the view, not in `StageDef`: `three-renderer/scenery/` builds each stage's
platforms, lights and animated backdrop from its platforms, picked by stage id (Battlefield and
Final Destination; other stages get plain blocks). Textures are painted on a canvas at load time
and backdrops are sky-dome shaders, so there are no asset files. Backdrops animate on match time
(`cycles.ts`, pure and tested), so they pause with the game. The rock and keel hanging below a
stage sit behind the fighters' plane, so they never look solid where fighters can pass.
The match camera (`three-renderer/match-camera.ts`, pure math and tested) frames the drawn
bodies of every fighter still in the game, off-stage too, below the HUD, backing off no further
than the stage's `blastZone` (widened by any body reaching past it). It eases by elapsed game
frames, so it glides the same at any refresh rate and holds still in a pause, and backs off at
once where gliding would lose a fighter launched fast. The HUD height
comes from the composition root (`ThreeViewOptions.coveredTop` in `main.ts`), not a port.

**Enforced:** ESLint `no-restricted-imports` per folder (`eslint.config.js`) and a separate
`tsconfig.core.json` without DOM types, so `document` or `window` in core fails typecheck.

## One frame

1. `main.ts` hands `App` a list of input devices: the two keyboard halves and four gamepads
   (`GamepadInputSource` polls the Gamepad API, since gamepad buttons have no events). While a
   match runs, `App` samples each player's device and calls `session.setInput(slot, input)`. On
   character select it samples every device, and on every frame it polls the gamepads for menu
   commands; see Screens. Adapters deliver stick values with the deadzone already removed
   (`applyDeadzone`); telling a tilt from a smash is a game rule, so it lives in core
   (`attack-input.ts`: a plain-data `StickTracker` in each fighter's state, read when a button
   is pressed to pick the move slot).
2. `session.update(now)` asks `FixedStepClock` how many 1/60 s ticks are due and runs
   `step()` that many times. Rendering speed never changes game speed.
3. Each `GameView` renders `session.view()`: previous state, current state and `alpha`, so
   visuals interpolate smoothly on 120/144 Hz screens.
4. Events from `step()` (`hit`, `ko`, `match-end`) go to `session.onEvent` listeners (sound,
   particles; future: rumble). A `hit` carries that hit's own `damage`, where it landed and its
   `launch` speed, and whether a block took or broke under it (`guard`, #50); a `ko` carries where the fighter left the blast zone. `main.ts` gives
   `createViews` the session so the Three.js view can listen.

## Sound

Sound goes through the `AudioOutput` port (ADR 0007): named cues such as `menu-move` or `hit`,
and music tracks by id, on a music and an effects channel. `main.ts` gives `App` a
`WebAudioOutput` wrapped in a `RecordingAudioOutput`; the recorder keeps the last 1000 cues and
tracks for `__SSB__.sounds()`. `WebAudioOutput` synthesizes every cue from plain data (`cues.ts`: tones and noise bursts
with a pitch glide and a fade). Core never plays sound. Menus play their cues in `MenuPanel` (move, confirm, adjust, back; an option
can name its own cue, like `match-start` on a stage). Character select plays one cue per frame
from the change between its state before and after (`selectCue` in `menu-sounds.ts`: join,
leave, pick, un-pick, rules, cursor move), so a held button stays quiet. Start, Back and a click on the rules
banner play their cue in `App` directly. During a match, `App` plays fight cues (`match-sounds.ts`): hits
(heavier with more damage), KOs and the match end from session events, and a move starting, a
jump and a landing from the change between the last state it took sounds from and the current
one, so core needs no sound events. A fighter in hitstun only makes a landing sound. Each screen
names its music (`screenMusic`: the stage's own track in a match, a jingle on results, the menu
theme elsewhere). Songs are plain data in `songs.ts` (voices of notes or drum hits on a grid of
sixteenth steps, `music.ts`); `WebAudioOutput` plays them with a step sequencer that schedules a
fraction of a second ahead on the audio clock, and crossfades over one second when the track
changes. The Music and Effects volumes (0 to 10, on the Sound screen under Options) live in
`audio-settings.ts`: `App` loads them at start, passes them to `setVolume` on a square curve,
and saves each change to the `settings` store `main.ts` hands it (`localStorage`). Reading or
saving may fail (blocked storage); the defaults or the current values then simply apply.

## Screens

`src/app/screens.ts` lists the screens (title, main menu, options, sound, controls, character select,
stage select, match, results) and the allowed moves between them, as plain data with a unit test.
A versus match ends in results; training is left from its panel straight to the main menu.
`App` shows menu screens as HTML over the canvas. Behind the title and the menus stands one
decorative Three.js scene, the menu backdrop (`menu-backdrop.ts`): a fighter in a forward smash
on a stone platform in a spotlight, fog, rising embers (`ember-drift.ts`) and broken pillars
against a distant fire. It uses the core skeleton and poses without running a match, stays alive
while the player moves between menus, stands still under reduced motion, draws only as often as
its measured cost allows (`frame-budget.ts`: every frame on a real GPU, a new picture every few
seconds on CI's software renderer), and releases its WebGL
resources when a screen with its own scene opens (`hasMenuBackdrop` in `screens.ts`: character
select, match and results). The HTML start button also accepts keyboard and gamepad input. As in Melee, character select is where a match is
set up: its top bar holds Back and the rules banner, which opens the rules overlay (a second
`MenuPanel`, editing a draft that applies on Done). Options holds game settings only: directions
navigate between its panels (Screen, Sound, Controls), and confirming Screen toggles fullscreen. On character
select a device joins the first of four free player slots by pressing attack, then moves that
player's cursor; special un-picks, then leaves the slot (later players move up, so slots have no
gaps), and from a device that has not joined goes back. Before joining, directions select only match rules and Back. Down clears header focus,
allowing attack to join at the first fighter. Unjoined devices cannot browse the roster;
confirming a header action opens rules or goes back. Joined players use the same header navigation and keep
their picks. The last device to act synchronizes native header focus, so keyboard Enter activates
Back or rules when focused. Start, or attack on the roster once everyone joined
has picked, starts (two to four players); `PlayerInput.start` is the pad's Start button, and the
simulation ignores it. The match gets the joined players in slot order, each with their own
device. The controls screen names devices (left keys, right keys, gamepad), not players.
Matches do not display control instructions. Press detection lives in `character-select.ts`. The other menus (`MenuPanel`, stage
select and the rules overlay included) read the keyboard as DOM keys and the gamepads as polled
devices: `menu-commands.ts` turns presses into commands for `MenuPanel.command()`, which moves the
focus to the nearest button in that direction (`spatial-focus.ts`), so the Back button is reachable
too. Stage select shows a centered grid of named cards: thumbnails capture the actual match
scenery once per stage, then release their GPU resources and reuse the images. Mouse clicks,
keyboard arrows/WASD and gamepad directions select cards through the same menu handling.
The menus use the Kombat look (`menu-theme.css`, colour and font tokens in `style.css`): a gold
serif heading and a list of entries, the focused one marked by a diamond and an ember glow. The
two fonts ship as woff2 files in `src/app/fonts/` (`fonts.css`, SIL Open Font License), so there
is no runtime font dependency.
`MenuPanel` composes the heading, optional data panel and options; each screen supplies its own
variant in `app.ts`. Results frames a Three.js medal podium, and stage select centres its
thumbnail grid. At the bottom of each menu, `MenuPanel` shows the button bar (`button-prompts.ts`:
which button selects, changes a setting, starts or goes back there), named for the kind of device
used last in any menu: a key press makes it keyboard names, a `command()` from a gamepad makes it
pad names. `menu-theme.css` also frames the rules overlay. Character select is a 3D set
(`lobby-scene.ts`): four stone platforms in a row, one per player slot, built from the same
pieces as the menu backdrop (`firelit-set.ts`). The camera stands back just far enough that the
platforms line up with the four nameplate columns below them (`lobby-layout.ts`). A joined
player's platform lights up in their colour with their fighter on it (in a forward smash once
ready); an open one stays dark. `CharacterSelectView` hands the scene one stand per slot
(`lobbyStands` in `character-select.ts`), and the scene redraws only when a stand changes, within
the same frame budget as the backdrop. `fighter-lobby.css` lays out the top bar (Back, title,
rules), the roster as a row of diamonds and the nameplates. `fighter-portrait.ts` captures each
roster and HUD portrait once in a temporary WebGL context, caches the PNG, and releases all GPU resources.
`fighter-model.ts` shares
body geometry, materials and player colors with gameplay and results. Each character's look is a
`PartBuilder` (`models/`): rigid primitives per bone of the shared core skeleton, so poses,
hurtboxes and moves never depend on the model. Each look names the one colour that becomes the
player's colour (the whole capsule, Rivet's overalls, Vela's armour plates), so mirror matches stay readable. Player previews follow the
roster cursor before confirmation and retain confirmed picks; header navigation retains the last
browsed fighter. Input labels come from the app’s device metadata. Only the focused entry lights up; hover brightens text only, so the mouse and a gamepad never show two selections. A short confirmation overlay
runs independently of navigation; reduced motion disables it and menu transitions.
Browser tests check visibility and overlap across desktop, portrait, compact and short landscape
viewports, including four-player results. `ResultsScene` renders gold, silver, bronze and fourth-place
steps with the match skeleton and player colors; first place carries a laurel wreath. The app records
stock eliminations (including their simulation frame) from existing session events to order the
podium; timed matches use KOs minus falls, and ties share a place. The static scene renders on resize
and disposes its observer, geometry, textures and WebGL context when leaving results.

Every screen change plays the blade wipe (`screen-transition.ts`): `App.navigate` renders its 3D
scenes once more, then the wipe snapshots the container (DOM cloned, canvases copied to 2D) into
a closed, `aria-hidden` shadow root on top and cuts it away behind a band of slanted blades
(geometry in `screen-wipe.ts`, pure and tested). The real screen changes in the same task, so
input, the debug handle and tests never wait on the animation, and the copies are invisible to
locators. Reduced motion skips it.

A match starts in the `countdown` phase (`COUNTDOWN` in `config.ts`): `step` lets the fighters
settle with neutral input until `goFrame`, then plays; `timeLeftFrames` counts from GO
(`playedFrames`). `DomHud` reads the phase to show READY, GO! and, once the match is finished,
GAME! (`bannerKind` in `dom-hud/match-banner.ts`, tested), in the blade style of the wipe
(`match-banner.css`). The winner is named only on the results screen. Scenario tests skip the
countdown (`countdownFrames: 0` in `newMatch`).

Above the match, `DomHud` lays one plate per player across the top, half on each side of the
clock (`plateLayout` in `dom-hud/hud-plates.ts`, tested, with `heat` and `stockMarks`). The plate's
portrait comes from the composition root (`DomHudOptions.portrait`), so the HUD itself needs no
WebGL; the styles are in `match-hud.css`.

Training mode (#144, ADR 0008) is data in the match: `MatchConfig.training` starts a match
with `MatchState.training` (the dummy's `TrainingSettings` and the measurements). `step` hands the
dummy `dummyInput` instead of its slot's input, never ends the match and costs no stocks, and
`trackTraining` (`training.ts`) counts the combo (hits while the dummy stays in hitstun or hitlag)
and follows the last hit until attacker and dummy can both act: the frame advantage. The
`TrainingControls` port pauses, advances one frame, changes settings (`configureTraining`) and
resets (`resetTraining`) between frames; `LocalTrainingSession` implements it. `TrainingHud`
(`dom-hud/training-hud.ts`, text from `training-readout.ts`) draws the readout, including how the
player's last aerial landed (L-cancelled, missed or auto-cancelled), and the panel is a
`MenuPanel` in `App` (`training-menu.ts` holds its rows).

Menus with a way back show a Back button in their top left corner, except results and the
rules overlay, whose own buttons (Main menu, Done) do that job. Every screen listens on `window`,
so each handler checks and marks the event in `key-events.ts`: one key press changes the screen at
most once. Entering `match` creates a `GameSession` and its views; leaving it disposes them, so
every match starts clean.

## Determinism rules

- `step()` is pure: same state and inputs, same result. A test replays 1200 scripted frames
  twice and compares the JSON.
- No wall-clock time, no unseeded randomness, no iteration over unordered keys in core.
- State is plain data (`MatchState`), cloneable with `structuredClone` and sendable as JSON.
- Floating point is deterministic on one machine and engine. Cross-platform determinism
  (needed for peer-to-peer rollback) may later require fixed-point math; see ADR 0003.

## Moving logic to a server

The seam is `GameSession`. The plan for online play (see "Later" in the product roadmap):

1. Run `src/core` in Node on a server (it has no browser dependencies, enforced).
2. Add `RemoteGameSession implements GameSession` in `src/adapters/remote-session`. `setInput`
   sends inputs over a WebSocket; `update` applies received snapshots and predicts locally with
   the same `step()`.
3. `TrainingControls` (ADR 0008) is a second seam: a remote session implements it or refuses
   training, which is local only today.
4. Change one line in `src/app/main.ts` to pick the remote session. Views and inputs stay as
   they are. Sound, hit sparks and KO bursts come from session events, so the remote session
   must report each `hit` and `ko` exactly once, even when a rollback replays predicted frames.

Other logic follows the same pattern: define a port first, implement locally, swap later.

## Testing strategy

| Level | Tool       | What                                                                                                                           | Where               |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Unit  | Vitest     | Game rules as scenarios (`settled`, `run`, `withFighter`)                                                                      | `src/**/*.test.ts`  |
| Unit  | Vitest     | Adapters with fakes (e.g. keyboard with an `EventTarget`)                                                                      | next to the adapter |
| E2E   | Playwright | Full flow from title to results and back (match ended via `__SSB__.hold`), keys move fighters, sounds heard (`__SSB__.sounds`) | `e2e/`              |

## Decisions

- [0001 Record architecture decisions](adr/0001-record-architecture-decisions.md)
- [0002 Ports and adapters around a pure core](adr/0002-ports-and-adapters.md)
- [0003 Deterministic fixed-timestep simulation](adr/0003-deterministic-fixed-timestep.md)
- [0004 TypeScript, Vite and Three.js](adr/0004-typescript-vite-threejs.md)
- [0005 Body pose is part of the game state](adr/0005-body-pose-in-game-state.md)
- [0006 Moves are plain data run by one move runner](adr/0006-move-definition-format.md)
- [0007 Sound plays through an audio port, synthesized for now](adr/0007-audio-port.md)
- [0008 Training mode: dummy and readout in core, pause and settings through a port](adr/0008-training-controls-port.md)
