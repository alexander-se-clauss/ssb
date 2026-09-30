import { findCharacter, type MatchState } from '../core';

/** One line of the results table. */
export interface ResultRow {
  readonly player: string;
  readonly character: string;
  readonly kos: number;
  readonly falls: number;
  /** Rounded to whole percent. */
  readonly damageDealt: number;
  readonly winner: boolean;
}

export const resultHeading = (state: MatchState): string =>
  state.winner === null ? 'Draw' : `Player ${state.winner + 1} wins!`;

export const resultRows = (state: MatchState): ResultRow[] =>
  state.fighters.map((fighter) => ({
    player: `P${fighter.slot + 1}`,
    character: findCharacter(fighter.characterId)?.name ?? fighter.characterId,
    kos: fighter.kos,
    falls: fighter.falls,
    damageDealt: Math.round(fighter.damageDealt),
    winner: fighter.slot === state.winner,
  }));

const COLUMNS = ['Player', 'Fighter', 'KOs', 'Falls', 'Damage dealt'];

/** The stats table for the results screen. */
export const renderResults = (state: MatchState): HTMLTableElement => {
  const table = document.createElement('table');
  table.className = 'results-table';
  const head = table.createTHead().insertRow();
  for (const title of COLUMNS) {
    const cell = document.createElement('th');
    cell.textContent = title;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const row of resultRows(state)) {
    const line = body.insertRow();
    if (row.winner) line.className = 'winner';
    const values = [row.player, row.character, row.kos, row.falls, `${row.damageDealt}%`];
    for (const value of values) line.insertCell().textContent = String(value);
  }
  return table;
};
