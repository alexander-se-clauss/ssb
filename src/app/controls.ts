/** Readable key names for one player, given by `main.ts` from whichever input adapter it uses. */
export interface ControlLabels {
  readonly move: string;
  readonly jump: string;
  readonly down: string;
  readonly attack: string;
  readonly special: string;
}

const ACTIONS: readonly (readonly [keyof ControlLabels, string])[] = [
  ['move', 'Move'],
  ['jump', 'Jump'],
  ['down', 'Drop / fast-fall'],
  ['attack', 'Attack · pick in menus'],
  ['special', 'Special · cancel in menus'],
];

/** One row per action: its name, then each player's key. */
export const controlRows = (players: readonly ControlLabels[]): string[][] =>
  ACTIONS.map(([field, name]) => [name, ...players.map((labels) => labels[field])]);

/** The table on the controls screen. */
export const renderControls = (players: readonly ControlLabels[]): HTMLTableElement => {
  const table = document.createElement('table');
  table.className = 'menu-table';
  const head = table.createTHead().insertRow();
  for (const title of ['', ...players.map((_, index) => `P${index + 1}`)]) {
    const cell = document.createElement('th');
    cell.textContent = title;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const row of controlRows(players)) {
    const line = body.insertRow();
    for (const value of row) line.insertCell().textContent = value;
  }
  return table;
};
