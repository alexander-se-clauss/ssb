/**
 * Which move a press asks for (#28). The situation (ground or air), the button and the stick
 * resolve to a move slot; each character fills its slots with move ids, and a slot can be empty.
 */
import type { AttackDirection, AttackStrength } from './attack-input';

/** The slots a button press can ask for. */
export const PRESS_SLOTS = [
  'jab',
  'forwardTilt',
  'upTilt',
  'downTilt',
  'forwardSmash',
  'upSmash',
  'downSmash',
  'neutralAir',
  'forwardAir',
  'backAir',
  'upAir',
  'downAir',
  'neutralSpecial',
  'sideSpecial',
  'upSpecial',
  'downSpecial',
] as const;

/**
 * Every slot: the press slots, the attack from the ledge (#41), which climbing starts, the
 * attack out of a knockdown (#158), and the grabs (#159), which the grab button picks from by what
 * the fighter is doing: standing, dashing or running, or turning out of a run.
 */
export const MOVE_SLOTS = [
  ...PRESS_SLOTS,
  'ledgeAttack',
  'getupAttack',
  'grab',
  'dashGrab',
  'pivotGrab',
] as const;

export type PressSlot = (typeof PRESS_SLOTS)[number];
export type MoveSlot = (typeof MOVE_SLOTS)[number];

export interface SlotSituation {
  readonly grounded: boolean;
  readonly button: 'attack' | 'special';
  readonly attack: { readonly direction: AttackDirection; readonly strength: AttackStrength };
}

export interface SlotChoice {
  readonly slot: PressSlot;
  /** The move is aimed behind the fighter, which turns around before it starts. */
  readonly turnAround: boolean;
}

const GROUND_TILTS: Readonly<Record<AttackDirection, PressSlot>> = {
  neutral: 'jab',
  forward: 'forwardTilt',
  back: 'forwardTilt',
  up: 'upTilt',
  down: 'downTilt',
};

const GROUND_SMASHES: Readonly<Record<AttackDirection, PressSlot>> = {
  neutral: 'jab',
  forward: 'forwardSmash',
  back: 'forwardSmash',
  up: 'upSmash',
  down: 'downSmash',
};

const AERIALS: Readonly<Record<AttackDirection, PressSlot>> = {
  neutral: 'neutralAir',
  forward: 'forwardAir',
  back: 'backAir',
  up: 'upAir',
  down: 'downAir',
};

const SPECIALS: Readonly<Record<AttackDirection, PressSlot>> = {
  neutral: 'neutralSpecial',
  forward: 'sideSpecial',
  back: 'sideSpecial',
  up: 'upSpecial',
  down: 'downSpecial',
};

/** True for the five aerial slots, which only exist in the air. */
export const isAerialSlot = (action: string): boolean =>
  (Object.values(AERIALS) as string[]).includes(action);

/**
 * The slot for a press. Aerials have their own back slot, so only ground attacks and side
 * specials turn the fighter around.
 */
export const moveSlot = ({ grounded, button, attack }: SlotSituation): SlotChoice => {
  const back = attack.direction === 'back';
  if (button === 'special') return { slot: SPECIALS[attack.direction], turnAround: back };
  if (!grounded) return { slot: AERIALS[attack.direction], turnAround: false };
  const table = attack.strength === 'smash' ? GROUND_SMASHES : GROUND_TILTS;
  return { slot: table[attack.direction], turnAround: back };
};
