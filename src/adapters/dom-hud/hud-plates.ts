/** Damage at which the meter is full; it stays full beyond. Around where KOs start in Melee. */
export const HEAT_FULL_DAMAGE = 150;

/** More lives than this are shown as a count instead of diamonds. */
export const MAX_STOCK_MARKS = 5;

export type PlateSide = 'left' | 'right';

/** How full the damage meter is, from 0 (fresh) to 1 (in KO range). */
export const heat = (damage: number): number => Math.min(1, Math.max(0, damage / HEAT_FULL_DAMAGE));

/**
 * One diamond per starting life, true for the lives left; null when there are too many
 * diamonds to read at a glance.
 */
export const stockMarks = (stocks: number, total: number): boolean[] | null =>
  total > MAX_STOCK_MARKS ? null : Array.from({ length: total }, (_, life) => life < stocks);

/**
 * Where the plates go: half of the players left of the timer, the rest right of it, the left
 * side taking the extra one. Two players get long bars, more get compact plates.
 */
export const plateLayout = (players: number): { compact: boolean; sides: PlateSide[] } => {
  const left = Math.ceil(players / 2);
  return {
    compact: players > 2,
    sides: Array.from({ length: players }, (_, index) => (index < left ? 'left' : 'right')),
  };
};
