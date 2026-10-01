/** Minimal immutable 2D vector helpers. Gameplay happens on a 2D plane; depth is visual only. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Moves `value` towards `target` by at most `step`. */
export const approach = (value: number, target: number, step: number): number =>
  value < target ? Math.min(value + step, target) : Math.max(value - step, target);

export interface Rect {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}

export const circleIntersectsRect = (center: Vec2, radius: number, rect: Rect): boolean => {
  const nearestX = clamp(center.x, rect.left, rect.right);
  const nearestY = clamp(center.y, rect.bottom, rect.top);
  const dx = center.x - nearestX;
  const dy = center.y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
};

/** Whether a circle touches a capsule: the points within `capsuleRadius` of the segment a to b. */
export const circleIntersectsCapsule = (
  center: Vec2,
  radius: number,
  a: Vec2,
  b: Vec2,
  capsuleRadius: number,
): boolean => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  const t =
    lengthSquared === 0
      ? 0
      : clamp(((center.x - a.x) * abx + (center.y - a.y) * aby) / lengthSquared, 0, 1);
  const dx = center.x - (a.x + abx * t);
  const dy = center.y - (a.y + aby * t);
  const reach = radius + capsuleRadius;
  return dx * dx + dy * dy <= reach * reach;
};
