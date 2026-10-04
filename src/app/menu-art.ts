import { HUMANOID, POSES, plantedBoneSegments, vec2, type Pose } from '../core';

const SVG = 'http://www.w3.org/2000/svg';

const drawing = (markup: string, viewBox: string, className: string): SVGSVGElement => {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  // Only original, locally generated geometry goes into these decorative illustrations.
  svg.innerHTML = markup;
  return svg;
};

const fighter = (pose: Pose, facing: 1 | -1, x: number, y: number, scale: number): string => {
  const segments = plantedBoneSegments(HUMANOID, pose, vec2(0, 0), facing);
  return `<g transform="translate(${x} ${y}) scale(${scale} ${-scale})" fill="currentColor" stroke="currentColor" stroke-linecap="round">${HUMANOID.bones
    .map((bone) => {
      const { start, end } = segments[bone.id];
      return bone.shape === 'ball'
        ? `<circle cx="${(start.x + end.x) / 2}" cy="${(start.y + end.y) / 2}" r="${bone.radius}" stroke="none"/>`
        : `<path d="M${start.x} ${start.y} L${end.x} ${end.y}" stroke-width="${bone.radius * 2}"/>`;
    })
    .join('')}</g>`;
};

export type MenuArtwork =
  'versus' | 'training' | 'settings' | 'display' | 'controls' | 'sound' | 'rematch' | 'home';

/** Bold, original line art for the menu destinations; labels remain ordinary HTML. */
export const menuArtwork = (kind: MenuArtwork): SVGSVGElement => {
  const icons: Record<Exclude<MenuArtwork, 'versus'>, string> = {
    settings:
      '<path d="M65 48H235M65 90H235M65 132H235"/><circle cx="115" cy="48" r="12"/><circle cx="190" cy="90" r="12"/><circle cx="140" cy="132" r="12"/>',
    display:
      '<path d="M65 35H235V135H65ZM120 157H180M150 135V157M80 50H110M80 50V80M220 120H190M220 120V90"/>',
    controls:
      '<path d="M102 56H198Q224 56 233 82L247 123Q254 151 230 151L197 125H103L70 151Q46 151 53 123L67 82Q76 56 102 56ZM88 85V115M73 100H103"/><circle cx="201" cy="90" r="5"/><circle cx="218" cy="107" r="5"/>',
    rematch:
      '<path d="M211 56A69 69 0 1 0 219 117M211 25V60H177"/><path d="M134 64L170 90L134 116Z"/>',
    sound:
      '<path d="M70 70H105L150 35V145L105 110H70ZM180 65Q200 90 180 115M200 45Q235 90 200 135"/>',
    // A target on a stand: the training dummy (#144).
    training:
      '<circle cx="150" cy="78" r="52"/><circle cx="150" cy="78" r="22"/><path d="M150 130V158M112 158H188"/>',
    home: '<path d="M62 91L150 29L238 91M83 77V150H217V77M130 150V104H170V150"/>',
  };
  const markup =
    kind === 'versus'
      ? `<g opacity=".3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="150" cy="90" r="81"/><path d="M0 150L300 35M0 175L300 60"/></g>${fighter(POSES.jab, 1, 73, 157, 72)}${fighter(POSES.jab3, -1, 232, 122, 72)}`
      : `<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="square" stroke-linejoin="miter">${icons[kind]}</g>`;
  return drawing(markup, '0 0 300 180', 'menu-artwork');
};
