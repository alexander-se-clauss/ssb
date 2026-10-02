/** Distance between neighbouring platforms on character select, in scene units. */
export const PLATFORM_SPACING = 7;

/** Closest the camera comes, so a standing fighter keeps clear of the top on very wide screens. */
export const MIN_CAMERA_DISTANCE = 24;

/** The platform of player slot `slot` (0-3): four in a row, centred on the origin. */
export const platformX = (slot: number): number => (slot - 1.5) * PLATFORM_SPACING;

/**
 * How far back the camera stands so the platforms line up with the nameplates below them: the
 * screen is split into four equal columns, so the outer platform sits at 3/4 of the half width.
 */
export const rowCameraDistance = (verticalFov: number, aspect: number): number => {
  const halfWidthPerUnit = Math.tan(((verticalFov / 2) * Math.PI) / 180) * aspect;
  return Math.max(platformX(3) / 0.75 / halfWidthPerUnit, MIN_CAMERA_DISTANCE);
};
