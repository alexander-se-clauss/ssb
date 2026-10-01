/**
 * The blade wipe between screens. The app changes the screen at once; this only draws a snapshot
 * of the old screen on top and cuts it away behind a band of slanted blades (`screen-wipe.ts`).
 * So input and the debug handle follow the new screen immediately, and nothing waits on the
 * animation.
 *
 * The snapshot lives in a closed shadow root that is hidden from assistive technology: its copies
 * of buttons and headings are never found by tests, screen readers or `querySelector` on the page.
 */
import {
  WIPE_EASING,
  WIPE_MS,
  bladeTransform,
  oldScreenClip,
  wipeAt,
  wipeGeometry,
} from './screen-wipe';

/** Stripes of the blade band, left to right; the leading edge is on the right. */
const BLADE_STRIPES = ['trail', 'gap', 'body', 'edge', 'spark'] as const;

export class ScreenTransition {
  private layer: HTMLElement | undefined;
  /** The container size the running wipe was laid out for. */
  private size = { width: 0, height: 0 };

  constructor(private readonly container: HTMLElement) {}

  /**
   * Takes a snapshot of what the container shows now and starts wiping it away. Call it right
   * before the old screen is torn down; the new screen then builds up underneath in the same task,
   * so the browser never paints a frame without the snapshot. `prepare` runs first, only when the
   * wipe plays: it draws the 3D scenes, since a WebGL canvas can be copied only right after that.
   */
  play(prepare: () => void = () => undefined): void {
    this.finish();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    prepare();

    const layer = document.createElement('div');
    layer.className = 'screen-wipe';
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    const root = layer.attachShadow({ mode: 'closed' });
    root.adoptedStyleSheets = pageStyles();

    const old = document.createElement('div');
    old.className = 'screen-wipe-old';
    const { copies, scrolled } = snapshot(this.container);
    old.append(...copies);
    const band = document.createElement('div');
    band.className = 'screen-wipe-band';
    for (const stripe of BLADE_STRIPES) {
      const element = document.createElement('i');
      element.className = `screen-wipe-${stripe}`;
      band.append(element);
    }
    root.append(old, band);
    this.container.append(layer);
    this.layer = layer;
    this.size = { width, height };
    // Scroll positions are not cloned, and only apply once the copies are in the page.
    for (const { source, target } of scrolled) {
      target.scrollTop = source.scrollTop;
      target.scrollLeft = source.scrollLeft;
    }

    const geometry = wipeGeometry(width, height);
    band.style.width = `${geometry.bladeWidth}px`;
    const frames = [wipeAt(geometry, 0), wipeAt(geometry, 1)];
    const timing = { duration: WIPE_MS, easing: WIPE_EASING, fill: 'forwards' } as const;
    old.animate(
      frames.map((frame) => ({ clipPath: oldScreenClip(geometry, frame) })),
      timing,
    );
    band
      .animate(
        frames.map((frame) => ({ transform: bladeTransform(geometry, frame) })),
        timing,
      )
      .finished.then(() => {
        if (this.layer === layer) this.finish();
      })
      .catch(() => undefined);
  }

  /** The wipe is laid out in pixels; at a new size it ends, as a gap would show the new screen. */
  resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width !== this.size.width || height !== this.size.height) this.finish();
  }

  /** Removes a running wipe at once, e.g. when the next screen change starts. */
  finish(): void {
    this.layer?.remove();
    this.layer = undefined;
  }
}

interface Snapshot {
  readonly copies: HTMLElement[];
  /** Scrolled elements and their copies, to scroll the same way once in the page. */
  readonly scrolled: { readonly source: Element; readonly target: Element }[];
}

/**
 * Copies of the container's visible children. Canvases are copied pixel by pixel, since a cloned
 * canvas is blank; WebGL canvases must have been drawn in this task for the copy to hold an image.
 */
const snapshot = (container: HTMLElement): Snapshot => {
  const scrolled: { source: Element; target: Element }[] = [];
  const copies = [...container.children]
    .filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && !child.hidden && !child.classList.contains('screen-wipe'),
    )
    .map((child) => {
      const copy = child.cloneNode(true) as HTMLElement;
      const targets = canvasesIn(copy);
      canvasesIn(child).forEach((source, index) => {
        const target = targets[index];
        if (target) copyCanvas(source, target);
      });
      // cloneNode keeps the tree's shape, so elements pair up by document order.
      const copied = [copy, ...copy.querySelectorAll('*')];
      [child, ...child.querySelectorAll('*')].forEach((source, index) => {
        const target = copied[index];
        if (target && (source.scrollTop !== 0 || source.scrollLeft !== 0)) {
          scrolled.push({ source, target });
        }
      });
      return copy;
    });
  return { copies, scrolled };
};

const canvasesIn = (element: HTMLElement): HTMLCanvasElement[] =>
  element instanceof HTMLCanvasElement ? [element] : [...element.querySelectorAll('canvas')];

const copyCanvas = (source: HTMLCanvasElement, target: HTMLCanvasElement): void => {
  target.width = source.width;
  target.height = source.height;
  try {
    target.getContext('2d')?.drawImage(source, 0, 0);
  } catch {
    // A canvas that cannot be read stays blank; the menu background shows instead.
  }
};

/**
 * The page's own styles, for the snapshot in the shadow root. Rules are read again for every
 * wipe, so styles loaded later (or swapped by hot reload in development) are included.
 */
const pageStyles = (): CSSStyleSheet[] => {
  const sheet = new CSSStyleSheet();
  const rules: string[] = [];
  for (const source of document.styleSheets) {
    try {
      for (const rule of source.cssRules) rules.push(rule.cssText);
    } catch {
      // Sheets from other origins cannot be read; the game ships none.
    }
  }
  sheet.replaceSync(rules.join('\n'));
  return [sheet];
};
