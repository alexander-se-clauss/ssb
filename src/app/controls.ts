/** Readable button names for one device, given by `main.ts` from whichever input adapter it uses. */
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

/** One column of the controls table: a device and its button names. */
export interface ControlColumn {
  /** E.g. "Left keys" or "Gamepad". Devices aren't players: any of them can join as any player. */
  readonly device: string;
  readonly labels: ControlLabels;
}

/** One row per action: its name, then each device's button. */
export const controlRows = (players: readonly ControlLabels[]): string[][] =>
  ACTIONS.map(([field, name]) => [name, ...players.map((labels) => labels[field])]);

/** The table on the controls screen. */
export const renderControls = (columns: readonly ControlColumn[]): HTMLTableElement => {
  const table = document.createElement('table');
  table.className = 'menu-table';
  const head = table.createTHead().insertRow();
  for (const title of ['', ...columns.map((column) => column.device)]) {
    const cell = document.createElement('th');
    cell.textContent = title;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const row of controlRows(columns.map((column) => column.labels))) {
    const line = body.insertRow();
    for (const value of row) line.insertCell().textContent = value;
  }
  return table;
};
