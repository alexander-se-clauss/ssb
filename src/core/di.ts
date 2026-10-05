/**
 * Directional influence (#154), as in Melee: the stick a launched fighter holds on the last frame
 * of hitlag turns its launch by up to `DI.maxDegrees`, the most when held straight across it and
 * not at all along it. It changes where the launch goes, never how hard.
 */
import { DI, STICK } from './config';
import type { Vec2 } from './math';

/** `launch` turned by the DI of `stick` (deflection 0..1 per axis, a diagonal counts as 1). */
export const influence = (launch: Vec2, stick: Vec2): Vec2 => {
  const speed = Math.hypot(launch.x, launch.y);
  const push = Math.hypot(stick.x, stick.y);
  if (speed === 0 || push < STICK.deadzone) return launch;
  const reach = Math.min(push, 1) / push;
  // How far the stick points across the launch: positive turns it counter-clockwise.
  const across = ((launch.x * stick.y - launch.y * stick.x) / speed) * reach;
  const turn = (DI.maxDegrees * across * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return { x: launch.x * cos - launch.y * sin, y: launch.x * sin + launch.y * cos };
};
