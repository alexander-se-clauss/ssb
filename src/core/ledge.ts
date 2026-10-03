/**
 * Ledges (#40, #41): where a fighter hangs from one, which ledge a falling fighter catches, what
 * a hanging fighter does next and the path it climbs onto the stage. `fighter.ts` runs them.
 */
import { LEDGE } from './config';
import { pressed } from './input';
import type { Vec2 } from './math';
import { POSES } from './pose-data';
import { plantedBoneSegments } from './skeleton';
import type { CharacterDef, FighterAction, LedgeDef, PlayerInput, StageDef } from './types';

/**
 * Where a character hangs from a ledge: below and beside it, with the front hand of its hanging
 * pose on the ledge's corner. Measured on the character's own skeleton, so a taller body hangs
 * lower.
 */
export const hangPosition = (ledge: LedgeDef, character: CharacterDef): Vec2 => {
  const hand = plantedBoneSegments(character.skeleton, POSES.ledge, { x: 0, y: 0 }, ledge.facing)
    .lowerArmFront.end;
  return { x: ledge.position.x - hand.x, y: ledge.position.y - hand.y };
};

/**
 * The index of the closest free ledge whose hanging spot lies within `LEDGE.snap` of `position`,
 * or `null` if there is none. `taken` lists the ledges other fighters hold.
 */
export const ledgeInReach = (
  stage: StageDef,
  character: CharacterDef,
  position: Vec2,
  taken: readonly number[],
): number | null => {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const [index, ledge] of stage.ledges.entries()) {
    if (taken.includes(index)) continue;
    const hang = hangPosition(ledge, character);
    const dx = position.x - hang.x;
    const dy = position.y - hang.y;
    if (Math.abs(dx) > LEDGE.snap.x || dy > LEDGE.snap.above || dy < -LEDGE.snap.below) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
};

/** What a hanging fighter can do (#41). */
export type LedgeOption = 'stand' | 'roll' | 'attack' | 'jump' | 'drop';

/**
 * The option a fresh input picks this frame, or `null` to keep hanging: a button pressed now, or
 * the stick pushed past `LEDGE.stick` now. Something held since before does not count, so a
 * fighter that grabs the ledge holding jump or the stick towards the stage stays on it.
 */
export const ledgeOption = (
  input: PlayerInput,
  previous: PlayerInput,
  facing: 1 | -1,
): LedgeOption | null => {
  if (pressed(input, previous, 'jump')) return 'jump';
  if (pressed(input, previous, 'shield')) return 'roll';
  if (pressed(input, previous, 'attack') || pressed(input, previous, 'special')) return 'attack';
  const pushed = (now: number, before: number) => now > LEDGE.stick && before <= LEDGE.stick;
  const towards = input.x * facing;
  const towardsBefore = previous.x * facing;
  if (pushed(-input.y, -previous.y) || pushed(-towards, -towardsBefore)) return 'drop';
  if (pushed(input.y, previous.y) || pushed(towards, towardsBefore)) return 'stand';
  return null;
};

/** How many frames a climb takes before the fighter is on the stage. */
export const climbFrames = (action: LedgeClimb): number =>
  action === 'ledgeStand'
    ? LEDGE.getup.stand.climbFrames
    : action === 'ledgeAttack'
      ? LEDGE.getup.attack.climbFrames
      : LEDGE.getup.roll.climbFrames;

/** The climbing actions, from a ledge onto the stage. */
export type LedgeClimb = 'ledgeStand' | 'ledgeRoll' | 'ledgeAttack';

export const isLedgeClimb = (action: FighterAction): action is LedgeClimb =>
  action === 'ledgeStand' || action === 'ledgeRoll' || action === 'ledgeAttack';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.min(Math.max(t, 0), 1);

/**
 * Where a climbing fighter's feet are on `frame` of its climb: up beside the ledge in the first
 * half of `climbFrames`, then in onto the stage; a roll then carries on to its `distance`.
 */
export const climbPosition = (
  action: LedgeClimb,
  frame: number,
  ledge: LedgeDef,
  character: CharacterDef,
): Vec2 => {
  const { getup } = LEDGE;
  const hang = hangPosition(ledge, character);
  const onStage = (distance: number) => ledge.position.x + ledge.facing * distance;
  const climbDistance =
    action === 'ledgeStand'
      ? getup.stand.distance
      : action === 'ledgeAttack'
        ? getup.attack.distance
        : getup.roll.climbDistance;
  const climb = climbFrames(action);
  const half = climb / 2;
  if (frame < half) return { x: hang.x, y: lerp(hang.y, ledge.position.y, frame / half) };
  const climbed = lerp(hang.x, onStage(climbDistance), (frame - half) / half);
  if (action !== 'ledgeRoll' || frame <= climb) return { x: climbed, y: ledge.position.y };
  const rolled = (frame - climb) / (getup.roll.rollTo - climb);
  return {
    x: lerp(onStage(climbDistance), onStage(getup.roll.distance), rolled),
    y: ledge.position.y,
  };
};
