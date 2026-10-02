/** Every move in the game, by id. Characters map their move slots to these ids (#28). */
import { validateMove, type MoveDef, type MoveId } from '../moves';
import { BACK_AIR, DOWN_AIR, FORWARD_AIR, NEUTRAL_AIR, UP_AIR } from './aerials';
import { JAB, JAB2, JAB3 } from './jab';
import { DOWN_SMASH, FORWARD_SMASH, UP_SMASH } from './smashes';
import { DOWN_TILT, FORWARD_TILT, UP_TILT } from './tilts';

const ALL: readonly MoveDef[] = [
  JAB,
  JAB2,
  JAB3,
  FORWARD_TILT,
  UP_TILT,
  DOWN_TILT,
  FORWARD_SMASH,
  UP_SMASH,
  DOWN_SMASH,
  NEUTRAL_AIR,
  FORWARD_AIR,
  BACK_AIR,
  UP_AIR,
  DOWN_AIR,
];

/** Checks each move, and that every move a cancel goes into is in the same list. */
export const validateMoves = (moves: readonly MoveDef[]): void => {
  const ids = new Set(moves.map((move) => move.id));
  for (const move of moves) {
    validateMove(move);
    for (const cancel of move.cancels) {
      if (cancel.into !== undefined && !ids.has(cancel.into)) {
        throw new Error(`Move "${move.id}": cancels into unknown move "${cancel.into}"`);
      }
    }
  }
};

// Checked once when the game loads, so a broken definition fails at start, not mid-match.
validateMoves(ALL);

export const MOVES: Readonly<Record<MoveId, MoveDef>> = Object.fromEntries(
  ALL.map((move) => [move.id, move]),
);

/** The move with this id. Throws on an unknown id, which would be a bug or a bad snapshot. */
export const findMove = (id: MoveId): MoveDef => {
  // Own keys only, so ids such as "toString" are unknown, not Object.prototype members.
  const move = Object.hasOwn(MOVES, id) ? MOVES[id] : undefined;
  if (!move) throw new Error(`Unknown move "${id}"`);
  return move;
};
