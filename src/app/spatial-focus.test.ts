import { describe, expect, it } from 'vitest';
import { nearestInDirection, type Box } from './spatial-focus';

const box = (x: number, y: number, width = 100, height = 40): Box => ({ x, y, width, height });

// A Back button in the top left corner above a column of three buttons.
const BACK = box(0, 0, 60, 30);
const COLUMN = [box(200, 100), box(200, 160), box(200, 220)];
const ALL = [BACK, ...COLUMN];

describe('nearestInDirection', () => {
  it('moves down and up a column to the next button', () => {
    expect(nearestInDirection(ALL, 1, 'down')).toBe(2);
    expect(nearestInDirection(ALL, 2, 'up')).toBe(1);
  });

  it('reaches the Back button by going up from the top of the column', () => {
    expect(nearestInDirection(ALL, 1, 'up')).toBe(0);
  });

  it('finds nothing past the edge, so the caller can wrap or stay', () => {
    expect(nearestInDirection(ALL, 3, 'down')).toBe(-1);
    expect(nearestInDirection(ALL, 2, 'right')).toBe(-1);
  });

  it('moves left and right only to buttons on the same row', () => {
    expect(nearestInDirection(ALL, 1, 'left')).toBe(-1);
  });

  it('moves left and right between buttons on the same row', () => {
    const row = [box(0, 0), box(120, 0), box(240, 0), box(120, 60)];
    expect(nearestInDirection(row, 1, 'right')).toBe(2);
    expect(nearestInDirection(row, 1, 'left')).toBe(0);
  });

  it('prefers the button in line over a closer one off to the side', () => {
    const boxes = [box(0, 0), box(150, 80), box(0, 120)];
    expect(nearestInDirection(boxes, 0, 'down')).toBe(2);
  });
});
