/**
 * Geometry of the blade wipe that plays on every screen change: a band of slanted blades sweeps
 * from left to right, and the old screen is cut away along a line in the middle of the band, so
 * the new screen appears behind it. Pure numbers in pixels, so it is easy to test.
 */

/** How far the top of a blade leans right, per pixel of screen height. */
const SLANT_PER_HEIGHT = 0.3;

/** The band of blades is this share of the screen wide, but at least `MIN_BLADE_WIDTH`. */
const BLADE_SHARE = 0.45;
const MIN_BLADE_WIDTH = 320;

/** How long the wipe takes, and its easing: fast through the middle, soft at both ends. */
export const WIPE_MS = 460;
export const WIPE_EASING = 'cubic-bezier(0.7, 0, 0.3, 1)';

export interface WipeGeometry {
  readonly width: number;
  readonly height: number;
  readonly bladeWidth: number;
  /** How far right the top edge of the band sits from its bottom edge. */
  readonly slant: number;
}

export const wipeGeometry = (width: number, height: number): WipeGeometry => ({
  width,
  height,
  bladeWidth: Math.max(width * BLADE_SHARE, MIN_BLADE_WIDTH),
  slant: height * SLANT_PER_HEIGHT,
});

export interface WipeFrame {
  /** Left end of the band's bottom edge. */
  readonly bladeX: number;
  /** Where the cut through the old screen meets the top and the bottom of the screen. */
  readonly edgeTop: number;
  readonly edgeBottom: number;
}

/** The band and the cut at `progress` (0 to 1, before easing). Both move together, linearly. */
export const wipeAt = (geometry: WipeGeometry, progress: number): WipeFrame => {
  const { width, bladeWidth, slant } = geometry;
  const start = -(bladeWidth + slant);
  const bladeX = start + (width - start) * progress;
  const edgeBottom = bladeX + bladeWidth / 2;
  return { bladeX, edgeTop: edgeBottom + slant, edgeBottom };
};

/** The old screen's visible part: everything right of the cut. */
export const oldScreenClip = (geometry: WipeGeometry, frame: WipeFrame): string => {
  const right = geometry.width + geometry.slant;
  return `polygon(${frame.edgeTop}px 0, ${right}px 0, ${right}px ${geometry.height}px, ${frame.edgeBottom}px ${geometry.height}px)`;
};

/** The band's transform; it is skewed around its bottom left corner. */
export const bladeTransform = (geometry: WipeGeometry, frame: WipeFrame): string => {
  const degrees = (Math.atan2(geometry.slant, geometry.height) * 180) / Math.PI;
  return `translateX(${frame.bladeX}px) skewX(${-degrees}deg)`;
};
