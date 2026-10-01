import type { FighterState, GameEvent, MatchState } from '../core';
import type { SoundCue } from '../ports';

/** A cue to play, with how heavy it should sound (0 to 1). */
export interface FightCue {
  readonly cue: SoundCue;
  readonly strength?: number;
}

/** Damage at which a hit sounds as heavy as it gets. */
const HEAVIEST_HIT_DAMAGE = 20;

/** The sound for a session event: hits by their damage, KOs and the end of the match. */
export const eventCue = (event: GameEvent): FightCue => {
  switch (event.type) {
    case 'hit':
      return { cue: 'hit', strength: Math.min(1, event.damage / HEAVIEST_HIT_DAMAGE) };
    case 'ko':
      return { cue: 'ko' };
    case 'match-end':
      return { cue: 'match-end' };
  }
};

const fighterCues = (before: FighterState, after: FighterState): FightCue[] => {
  if (after.action === 'eliminated') return [];
  const cues: FightCue[] = [];
  // Fighters drop in at the start and on respawn, so those landings are heard too, and so is a
  // launched fighter hitting the floor.
  if (after.grounded && !before.grounded) cues.push({ cue: 'land' });
  if (after.action === 'hitstun') return cues;
  // A move started: a new move id, or the same move again after a cancel restarted it.
  if (
    after.moveId !== null &&
    (after.moveId !== before.moveId || after.actionFrame < before.actionFrame)
  ) {
    cues.push({ cue: 'attack' });
  }
  // Walking off a ledge also uses up the ground jump, but only a jump pushes upwards (even one
  // stopped at once by a platform above).
  if (after.jumpsRemaining < before.jumpsRemaining && after.velocity.y > before.velocity.y) {
    cues.push({ cue: 'jump' });
  }
  return cues;
};

/**
 * Sounds for what fighters did between two states: a move starting, a jump, a landing. These
 * are not session events, so they are read from the change in state. `before` should be the
 * last state these cues were taken from, not the previous tick, so nothing is missed when a
 * frame runs several ticks. A landing and a new jump in the same batch of ticks would hide each
 * other, which cannot happen while jump is not buffered (a press counts on the first tick only).
 */
export const stateCues = (before: MatchState, after: MatchState): FightCue[] =>
  after.fighters.flatMap((fighter) => {
    const earlier = before.fighters.find((f) => f.slot === fighter.slot);
    return earlier ? fighterCues(earlier, fighter) : [];
  });
