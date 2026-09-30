import type { StageDef } from '../core';

/** A platform in preview space: 0..1 on both axes, y pointing down like the screen. */
export interface PreviewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly passThrough: boolean;
}

/** Thin pass-through platforms would vanish at preview size, so they get at least this. */
const MIN_HEIGHT = 0.02;

/** The stage's platforms scaled into its blast zone, for a flat preview drawing. */
export const previewRects = (stage: StageDef): PreviewRect[] => {
  const zone = stage.blastZone;
  const width = zone.right - zone.left;
  const height = zone.top - zone.bottom;
  return stage.platforms.map(({ bounds, passThrough }) => ({
    x: (bounds.left - zone.left) / width,
    y: (zone.top - bounds.top) / height,
    width: (bounds.right - bounds.left) / width,
    height: Math.max((bounds.top - bounds.bottom) / height, MIN_HEIGHT),
    passThrough,
  }));
};

const SVG = 'http://www.w3.org/2000/svg';

/** Draws the preview as an SVG, true to the blast zone's proportions. */
export const renderPreview = (stage: StageDef): SVGSVGElement => {
  const zone = stage.blastZone;
  const aspect = (zone.right - zone.left) / (zone.top - zone.bottom);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${aspect} 1`);
  svg.setAttribute('class', 'stage-preview');
  svg.setAttribute('aria-label', `${stage.name} preview`);
  for (const rect of previewRects(stage)) {
    const shape = document.createElementNS(SVG, 'rect');
    shape.setAttribute('x', String(rect.x * aspect));
    shape.setAttribute('y', String(rect.y));
    shape.setAttribute('width', String(rect.width * aspect));
    shape.setAttribute('height', String(rect.height));
    shape.setAttribute('class', rect.passThrough ? 'platform pass-through' : 'platform');
    svg.append(shape);
  }
  return svg;
};
