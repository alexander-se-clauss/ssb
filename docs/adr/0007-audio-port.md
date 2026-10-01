# 0007 Sound plays through an audio port, synthesized for now

- Status: Proposed
- Date: 2026-10-01

## Context

Epic #83 adds music and sound effects: menu ticks and clicks, attack, hit and KO sounds, a menu
theme and a track per stage, and volume settings. Sound is presentation, like the 3D view, so it
must not touch `src/core`, which stays deterministic and silent (ADR 0002, 0003). Unlike the view,
sound also plays outside a match (menus), and the menus live in `src/app`, not in a `GameView`.

All content must be original. Art direction is still open (#10), so the style of the sounds may
change, and we do not want large downloads yet.

## Decision

A new port `AudioOutput` (`src/ports/audio-output.ts`) plays named cues and music tracks and sets
the volume of two channels (music, effects); `App` gets one from `main.ts` and calls it.

- **Cues name what happened** (`menu-move`, `hit`, `ko`), not how it sounds. A `strength` from 0
  to 1 makes a fight cue heavier, such as a strong hit; menu cues ignore it. The full list of cues for the epic is in the port
  now, so later tasks do not change it.
- **Music tracks are ids**: `menu`, a stage id, or `results`. `playMusic(null)` fades out.
- **The first adapter synthesizes everything** with the Web Audio API
  (`src/adapters/web-audio`): each cue is plain data (a few tones or noise bursts with a pitch
  glide and a fade), so there are no files to download and every sound is original. Recorded CC0
  samples can replace single cues later inside the adapter, without touching callers.
- **Fight sounds come from what core already reports**: `GameSession` events (hit, KO, match
  end) and the change between two `MatchState`s (a move starts, a jump, a landing). Core gets no
  audio code and no new events for sound.
- **A recording adapter** (`RecordingAudioOutput`) remembers what was played, so tests check
  sounds without listening (later also through the debug handle, #89).

## Consequences

- Menus, matches and Options all reach sound through one interface; swapping the synthesizer for
  samples, or muting it in tests, is a one-line change in `main.ts`.
- Adding a cue means adding it to the port's `SoundCue` union and to the adapter's cue table.
- Browsers keep audio suspended until a key press or click; gamepad presses do not count. A
  player on a pad only hears sound after their first key press or click.
- Sounds derived from state changes play when the view sees the change, so on a slow frame they
  can land a tick late. That is inaudible at 60 ticks per second.

## Alternatives considered

- **Audio as a `GameView`.** Views exist only during a match; menu sounds would need a second
  path anyway.
- **Sound events in core** (a `move-start` or `jump` event). Cleaner for the adapter, but it adds
  presentation concerns to the rules and would collide with the move engine work in Sprint 3. Can
  come later if state diffs prove fragile.
- **A library such as Howler.js or Tone.js.** A runtime dependency for features the Web Audio API
  already has in a few dozen lines.
- **Recorded samples first.** More realistic, but downloads and licence tracking before the art
  direction is decided.
