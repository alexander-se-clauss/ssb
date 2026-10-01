/**
 * Which screen the app shows, as a small state machine: a list of screens and the moves
 * allowed between them. Plain data and pure functions, so it is easy to test and to extend.
 */
export const SCREENS = [
  'title',
  'main-menu',
  'options',
  'controls',
  'character-select',
  'stage-select',
  'match',
  'results',
] as const;

export type Screen = (typeof SCREENS)[number];

export const INITIAL_SCREEN: Screen = 'title';

/** For each screen, where the player can go next. The first entry is the default choice. */
const TRANSITIONS: Readonly<Record<Screen, readonly Screen[]>> = {
  title: ['main-menu'],
  'main-menu': ['character-select', 'options', 'title'],
  options: ['controls', 'main-menu'],
  controls: ['options'],
  'character-select': ['stage-select', 'main-menu'],
  'stage-select': ['match', 'character-select'],
  // Leaving a match early (pause menu) comes later; for now a match always ends in results.
  match: ['results'],
  results: ['match', 'main-menu'],
};

export const nextScreens = (from: Screen): readonly Screen[] => TRANSITIONS[from];

export const canGo = (from: Screen, to: Screen): boolean => TRANSITIONS[from].includes(to);

/** Returns the new screen, or throws if the move is not allowed. */
export const go = (from: Screen, to: Screen): Screen => {
  if (!canGo(from, to)) throw new Error(`Screen change not allowed: ${from} -> ${to}`);
  return to;
};

export interface MenuEntry {
  readonly label: string;
  readonly to: Screen;
}

/** The main menu, top to bottom. Escape goes back to the title screen. */
export const MAIN_MENU: readonly MenuEntry[] = [
  { label: 'VS. Mode', to: 'character-select' },
  { label: 'Options', to: 'options' },
];
