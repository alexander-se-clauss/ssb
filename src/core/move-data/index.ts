/** Every move in the game, by id. Characters will map their move slots to these ids (#28). */
import { validateMove, type MoveDef, type MoveId } from '../moves';
import { JAB } from './jab';

const ALL: readonly MoveDef[] = [JAB];

// Checked once when the game loads, so a broken definition fails at start, not mid-match.
for (const move of ALL) validateMove(move);

export const MOVES: Readonly<Record<MoveId, MoveDef>> = Object.fromEntries(
  ALL.map((move) => [move.id, move]),
);

/** The move with this id. Throws on an unknown id, which would be a bug or a bad snapshot. */
export const findMove = (id: MoveId): MoveDef => {
  const move = MOVES[id];
  if (!move) throw new Error(`Unknown move "${id}"`);
  return move;
};
