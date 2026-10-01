/**
 * Spatial navigation for menus: from the focused element, find the nearest element in the pushed
 * direction by where things are on screen, so any layout works without listing neighbours by
 * hand. Up and down may change column; left and right stay on the same row.
 */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Sideways distance weighs more than forward distance, so elements in line win. */
const SIDEWAYS_WEIGHT = 3;

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const sameRow = (a: Box, b: Box): boolean => a.y < b.y + b.height && b.y < a.y + a.height;

/** Index of the nearest box in `direction` from `boxes[from]`, or -1 if there is none. */
export const nearestInDirection = (
  boxes: readonly Box[],
  from: number,
  direction: Direction,
): number => {
  const start = boxes[from];
  if (!start) return -1;
  const origin = centre(start);
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((candidate, index) => {
    if (index === from) return;
    // Left and right stay on the row, so they never jump to e.g. the Back button in a corner.
    if ((direction === 'left' || direction === 'right') && !sameRow(start, candidate)) return;
    const c = centre(candidate);
    const dx = c.x - origin.x;
    const dy = c.y - origin.y;
    const [forward, sideways] =
      direction === 'up'
        ? [-dy, dx]
        : direction === 'down'
          ? [dy, dx]
          : direction === 'left'
            ? [-dx, dy]
            : [dx, dy];
    if (forward <= 0) return;
    const score = forward + SIDEWAYS_WEIGHT * Math.abs(sideways);
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
};
