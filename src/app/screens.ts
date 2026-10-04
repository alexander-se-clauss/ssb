/**
 * Which screen the app shows, as a small state machine: a list of screens and the moves
 * allowed between them. Plain data and pure functions, so it is easy to test and to extend.
 */
export const SCREENS = [
  'title',
  'main-menu',
  'options',
  'sound',
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
  options: ['sound', 'controls', 'main-menu'],
  sound: ['options'],
  controls: ['options'],
  'character-select': ['stage-select', 'main-menu'],
  'stage-select': ['match', 'character-select'],
  // A versus match always ends in results; training (#144) is left from its panel.
  match: ['results', 'main-menu'],
  results: ['match', 'main-menu'],
};

export const nextScreens = (from: Screen): readonly Screen[] => TRANSITIONS[from];

export const canGo = (from: Screen, to: Screen): boolean => TRANSITIONS[from].includes(to);

/** Returns the new screen, or throws if the move is not allowed. */
export const go = (from: Screen, to: Screen): Screen => {
  if (!canGo(from, to)) throw new Error(`Screen change not allowed: ${from} -> ${to}`);
  return to;
};

/** Versus: two to four players fight. Training (#144): one player against a dummy. */
export type PlayMode = 'versus' | 'training';

export interface MenuEntry {
  readonly label: string;
  readonly to: Screen;
  /** For entries that lead to a match, which kind. */
  readonly mode?: PlayMode;
}

/** The main menu, top to bottom. Escape goes back to the title screen. */
export const MAIN_MENU: readonly MenuEntry[] = [
  { label: 'VS. Mode', to: 'character-select', mode: 'versus' },
  { label: 'Training', to: 'character-select', mode: 'training' },
  { label: 'Options', to: 'options' },
];

/** Screens that have their own 3D scene; the others share the menu backdrop. */
const OWN_SCENE: readonly Screen[] = ['character-select', 'match', 'results'];

/** Whether the firelit menu backdrop stands behind this screen. */
export const hasMenuBackdrop = (screen: Screen): boolean => !OWN_SCENE.includes(screen);
